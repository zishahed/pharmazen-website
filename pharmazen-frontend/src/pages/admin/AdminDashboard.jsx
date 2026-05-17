import { useState, useEffect } from 'react';
import { getMedicines, getCategories, getRestrictedMedicines } from '../../api/medicinesApi';
import {
  getDashboardStats,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  updateStock,
  getAllOrders,
  getAllUsers,
  getSalesAnalytics,
  updateOrderStatus,
  updateUserRole,
} from '../../api/adminApi';
import styles from './AdminDashboard.module.css';

const TABS = {
  DASHBOARD: 'dashboard',
  MEDICINES: 'medicines',
  ORDERS: 'orders',
  SALES: 'sales',
  USERS: 'users',
};

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [medicines, setMedicines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [salesData, setSalesData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [medFilters, setMedFilters] = useState({ categoryId: '', requiresPrescription: '', stockFilter: '' });
  const [orderFilters, setOrderFilters] = useState({ search: '', status: '', paymentStatus: '' });
  const [userFilters, setUserFilters] = useState({ search: '', role: '' });
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [stockEditId, setStockEditId] = useState(null);
  const [stockValue, setStockValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '', description: '', categoryId: '', price: '',
    stockQuantity: '', expiryDate: '', requiresPrescription: false,
  });

  const fetchDashboard = async () => {
    try {
      const statsRes = await getDashboardStats();
      setStats(statsRes.data);
    } catch (e) { console.error(e); }
  };

  const fetchMedicines = async (p = 1, filters) => {
    setLoading(true);
    try {
      const f = filters || medFilters;
      const params = { page: p, limit: 20, search };
      if (f.categoryId) params.categoryId = f.categoryId;
      if (f.requiresPrescription) params.requiresPrescription = f.requiresPrescription;
      const res = await getMedicines(params);
      const data = res.data.data || res.data;
      setMedicines(data.medicines || []);
      setTotalPages(data.totalPages || 1);
      const catRes = await getCategories();
      setCategories(catRes.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (orderFilters.search) params.search = orderFilters.search;
      if (orderFilters.status) params.status = orderFilters.status;
      if (orderFilters.paymentStatus) params.paymentStatus = orderFilters.paymentStatus;
      const res = await getAllOrders(params);
      setOrders(res.data.orders || res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (userFilters.search) params.search = userFilters.search;
      if (userFilters.role) params.role = userFilters.role;
      const res = await getAllUsers(params);
      setUsers(res.data.users || res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await getSalesAnalytics();
      setSalesData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchDashboard();
    fetchMedicines();
  }, []);

  useEffect(() => {
    if (activeTab === TABS.ORDERS) fetchOrders();
    if (activeTab === TABS.USERS) fetchUsers();
    if (activeTab === TABS.SALES) fetchSales();
    if (activeTab === TABS.MEDICINES || activeTab === TABS.DASHBOARD) fetchMedicines(page);
    if (activeTab === TABS.DASHBOARD) fetchDashboard();
  }, [activeTab, page]);

  useEffect(() => {
    if (activeTab === TABS.ORDERS) fetchOrders();
  }, [orderFilters.status, orderFilters.paymentStatus]);

  useEffect(() => {
    if (activeTab === TABS.USERS) fetchUsers();
  }, [userFilters.role]);

  const handleMedFilterChange = (key, value) => {
    const updated = { ...medFilters, [key]: value };
    setMedFilters(updated);
    setPage(1);
    fetchMedicines(1, updated);
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearch('');
    setMedFilters({ categoryId: '', requiresPrescription: '', stockFilter: '' });
    setOrderFilters({ search: '', status: '', paymentStatus: '' });
    setUserFilters({ search: '', role: '' });
    setPage(1);
  };

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchMedicines(1); };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', categoryId: categories[0]?.id || '', price: '', stockQuantity: '', expiryDate: '', requiresPrescription: false });
    setFormError(''); setShowModal(true);
  };

  const openEditModal = async (id) => {
    setEditingId(id); setFormError('');
    try {
      const res = await getMedicineById(id);
      const med = res.data;
      setFormData({
        name: med.name || '', description: med.description || '', categoryId: med.categoryId || '',
        price: med.price || '', stockQuantity: med.stockQuantity || '',
        expiryDate: med.expiryDate ? med.expiryDate.split('T')[0] : '', requiresPrescription: med.requiresPrescription || false,
      });
      setShowModal(true);
    } catch { setFormError('Failed to load medicine data'); }
  };

  const handleFormChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault(); setFormError(''); setFormSuccess('');
    if (!formData.name || !formData.categoryId || !formData.price || formData.stockQuantity === '') {
      setFormError('Please fill in all required fields'); return;
    }
    try {
      editingId ? await updateMedicine(editingId, formData) : await createMedicine(formData);
      setFormSuccess(editingId ? 'Medicine updated successfully' : 'Medicine created successfully');
      setTimeout(() => { setShowModal(false); fetchMedicines(page); }, 1000);
    } catch (err) { setFormError(err.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    try { await deleteMedicine(id); setDeleteConfirm(null); fetchMedicines(page); }
    catch { alert('Failed to delete medicine'); }
  };

  const handleStockUpdate = async (id) => {
    if (stockValue === '' || parseInt(stockValue) < 0) return;
    try { await updateStock(id, stockValue); setStockEditId(null); setStockValue(''); fetchMedicines(page); }
    catch { alert('Failed to update stock'); }
  };

  const handleOrderStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const handleUserRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update user role');
    }
  };

  const formatPrice = (p) => `৳${parseFloat(p).toFixed(2)}`;
  const statusClass = (s) => {
    const map = { pending: styles.statusPending, paid: styles.statusPaid, cancelled: styles.statusCancelled, awaiting_prescription: styles.statusWarning, completed: styles.statusPaid, failed: styles.statusCancelled, unpaid: styles.statusPending };
    return map[s] || '';
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Admin Panel</h2>
        <nav className={styles.sidebarNav}>
          <span className={activeTab === TABS.DASHBOARD ? styles.sidebarItemActive : styles.sidebarItem} onClick={() => switchTab(TABS.DASHBOARD)}>Dashboard</span>
          <span className={activeTab === TABS.MEDICINES ? styles.sidebarItemActive : styles.sidebarItem} onClick={() => switchTab(TABS.MEDICINES)}>Medicines</span>
          <span className={activeTab === TABS.ORDERS ? styles.sidebarItemActive : styles.sidebarItem} onClick={() => switchTab(TABS.ORDERS)}>Orders</span>
          <span className={activeTab === TABS.SALES ? styles.sidebarItemActive : styles.sidebarItem} onClick={() => switchTab(TABS.SALES)}>Sales</span>
          <span className={activeTab === TABS.USERS ? styles.sidebarItemActive : styles.sidebarItem} onClick={() => switchTab(TABS.USERS)}>Users</span>
        </nav>
      </div>

      <div className={styles.main}>
        {activeTab === TABS.DASHBOARD && (
          <>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            {stats && (
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.totalMedicines}</span>
                  <span className={styles.statLabel}>Total Medicines</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>৳{parseFloat(stats.totalRevenue || 0).toLocaleString()}</span>
                  <span className={styles.statLabel}>Total Revenue</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.totalOrders}</span>
                  <span className={styles.statLabel}>Total Orders</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.lowStockCount}</span>
                  <span className={styles.statLabel}>Low Stock Items</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.totalUsers}</span>
                  <span className={styles.statLabel}>Total Users</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statValue}>{stats.pendingPrescriptions}</span>
                  <span className={styles.statLabel}>Pending Prescriptions</span>
                </div>
              </div>
            )}
            <div className={styles.recentSection}>
              <h2 className={styles.sectionTitle}>Recent Medicines</h2>
              <MedicineTable
                medicines={medicines} loading={loading} page={page} totalPages={totalPages}
                setPage={setPage} search={search} setSearch={setSearch} handleSearch={handleSearch}
                openEditModal={openEditModal} setDeleteConfirm={setDeleteConfirm}
                stockEditId={stockEditId} setStockEditId={setStockEditId}
                stockValue={stockValue} setStockValue={setStockValue}
                handleStockUpdate={handleStockUpdate} formatPrice={formatPrice}
                medFilters={medFilters} handleMedFilterChange={handleMedFilterChange} categories={categories}
              />
            </div>
          </>
        )}

        {activeTab === TABS.MEDICINES && (
          <>
            <div className={styles.tabHeader}>
              <h1 className={styles.pageTitle}>Medicine Inventory</h1>
              <button onClick={openAddModal} className={styles.addBtn}>+ Add Medicine</button>
            </div>
            <MedicineTable
              medicines={medicines} loading={loading} page={page} totalPages={totalPages}
              setPage={setPage} search={search} setSearch={setSearch} handleSearch={handleSearch}
              openEditModal={openEditModal} setDeleteConfirm={setDeleteConfirm}
              stockEditId={stockEditId} setStockEditId={setStockEditId}
              stockValue={stockValue} setStockValue={setStockValue}
              handleStockUpdate={handleStockUpdate} formatPrice={formatPrice}
              medFilters={medFilters} handleMedFilterChange={handleMedFilterChange} categories={categories}
            />

            {showModal && (
              <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                  <h2 className={styles.modalTitle}>{editingId ? 'Edit Medicine' : 'Add New Medicine'}</h2>
                  {formError && <div className={styles.errorMsg}>{formError}</div>}
                  <form onSubmit={handleFormSubmit} className={styles.modalForm}>
                    <div className={styles.formGroup}><label>Medicine Name *</label><input type="text" name="name" value={formData.name} onChange={handleFormChange} className={styles.formInput} required /></div>
                    <div className={styles.formGroup}><label>Description</label><textarea name="description" value={formData.description} onChange={handleFormChange} className={styles.formTextarea} rows={2} /></div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}><label>Category *</label><select name="categoryId" value={formData.categoryId} onChange={handleFormChange} className={styles.formSelect} required><option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                      <div className={styles.formGroup}><label>Price (৳) *</label><input type="number" step="0.01" name="price" value={formData.price} onChange={handleFormChange} className={styles.formInput} required /></div>
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}><label>Stock Quantity *</label><input type="number" name="stockQuantity" value={formData.stockQuantity} onChange={handleFormChange} className={styles.formInput} required min="0" /></div>
                      <div className={styles.formGroup}><label>Expiry Date</label><input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleFormChange} className={styles.formInput} /></div>
                    </div>
                    <div className={styles.formGroup}><label className={styles.checkboxLabel}><input type="checkbox" name="requiresPrescription" checked={formData.requiresPrescription} onChange={handleFormChange} /> Requires Prescription</label></div>
                    <div className={styles.modalActions}>
                      <button type="button" onClick={() => setShowModal(false)} className={styles.cancelFormBtn}>Cancel</button>
                      <button type="submit" className={styles.submitFormBtn}>{editingId ? 'Update' : 'Create'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {deleteConfirm && (
              <div className={styles.modalOverlay} onClick={() => setDeleteConfirm(null)}>
                <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
                  <h3>Delete Medicine</h3>
                  <p>Are you sure you want to delete this medicine? This action cannot be undone.</p>
                  <div className={styles.modalActions}>
                    <button onClick={() => setDeleteConfirm(null)} className={styles.cancelFormBtn}>Cancel</button>
                    <button onClick={() => handleDelete(deleteConfirm)} className={styles.deleteConfirmBtn}>Delete</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === TABS.ORDERS && (
          <>
            <h1 className={styles.pageTitle}>All Orders</h1>
            <div className={styles.filterBar}>
              <div className={styles.searchForm}>
                <input type="text" placeholder="Search by customer name or email..." value={orderFilters.search}
                  onChange={(e) => setOrderFilters({ ...orderFilters, search: e.target.value })}
                  className={styles.searchInput} />
                <button onClick={() => fetchOrders()} className={styles.searchBtn}>Search</button>
              </div>
              <div className={styles.filterGroup}>
                <select value={orderFilters.status}
                  onChange={(e) => setOrderFilters({ ...orderFilters, status: e.target.value })}
                  className={styles.filterSelect}>
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="awaiting_prescription">Awaiting Prescription</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select value={orderFilters.paymentStatus}
                  onChange={(e) => setOrderFilters({ ...orderFilters, paymentStatus: e.target.value })}
                  className={styles.filterSelect}>
                  <option value="">All Payment</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
            {loading ? (
              <div className={styles.loadingCell}>Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className={styles.loadingCell}>No orders found</div>
            ) : (
              <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td className={styles.nameCell}>{o.id.slice(0, 8)}...</td>
                          <td>
                            <div className={styles.cellStack}>
                              <span>{o.customerName}</span>
                              <span className={styles.cellSub}>{o.customerEmail}</span>
                            </div>
                          </td>
                          <td>{o.items.length} item{o.items.length !== 1 ? 's' : ''}</td>
                          <td>{formatPrice(o.totalAmount)}</td>
                          <td><span className={`${styles.badge} ${statusClass(o.status)}`}>{o.status}</span></td>
                          <td><span className={`${styles.badge} ${statusClass(o.paymentStatus)}`}>{o.paymentStatus}</span></td>
                          <td className={styles.cellSub}>{new Date(o.createdAt).toLocaleDateString()}</td>
                          <td>
                            <select
                              value={o.status}
                              onChange={(e) => handleOrderStatusChange(o.id, e.target.value)}
                              className={styles.inlineSelect}
                            >
                              <option value="pending">Pending</option>
                              <option value="awaiting_prescription">Awaiting Rx</option>
                              <option value="paid">Paid</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            )}
          </>
        )}

        {activeTab === TABS.SALES && (
          <>
            <h1 className={styles.pageTitle}>Sales Analytics</h1>
            {loading ? (
              <div className={styles.loadingCell}>Loading sales data...</div>
            ) : !salesData ? (
              <div className={styles.loadingCell}>No sales data available</div>
            ) : (
              <>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>৳{salesData.summary.totalRevenue.toLocaleString()}</span>
                    <span className={styles.statLabel}>Total Revenue</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{salesData.summary.totalOrders}</span>
                    <span className={styles.statLabel}>Completed Orders</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>{salesData.summary.totalItemsSold}</span>
                    <span className={styles.statLabel}>Items Sold</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statValue}>৳{salesData.summary.averageOrderValue.toLocaleString()}</span>
                    <span className={styles.statLabel}>Avg Order Value</span>
                  </div>
                </div>

                <div className={styles.salesGrid}>
                  <div className={styles.salesCard}>
                    <h3 className={styles.salesCardTitle}>Revenue by Medicine</h3>
                    <div className={styles.salesTableWrap}>
                      <table className={styles.salesTable}>
                        <thead>
                          <tr><th>#</th><th>Medicine</th><th>Revenue</th><th>%</th></tr>
                        </thead>
                        <tbody>
                          {salesData.byMedicine.map((item, i) => (
                            <tr key={item.name}>
                              <td className={styles.rankCell}>{i + 1}</td>
                              <td className={styles.nameCell}>{item.name}</td>
                              <td className={styles.revenueCell}>৳{item.revenue.toLocaleString()}</td>
                              <td className={styles.pctCell}>{Math.round((item.revenue / salesData.summary.totalRevenue) * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={styles.salesCard}>
                    <h3 className={styles.salesCardTitle}>Revenue by Generic</h3>
                    <div className={styles.salesTableWrap}>
                      <table className={styles.salesTable}>
                        <thead>
                          <tr><th>#</th><th>Generic Name</th><th>Revenue</th><th>%</th></tr>
                        </thead>
                        <tbody>
                          {salesData.byGeneric.map((item, i) => (
                            <tr key={item.name}>
                              <td className={styles.rankCell}>{i + 1}</td>
                              <td className={styles.nameCell}>{item.name}</td>
                              <td className={styles.revenueCell}>৳{item.revenue.toLocaleString()}</td>
                              <td className={styles.pctCell}>{Math.round((item.revenue / salesData.summary.totalRevenue) * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={styles.salesCard}>
                    <h3 className={styles.salesCardTitle}>Revenue by Company</h3>
                    <div className={styles.salesTableWrap}>
                      <table className={styles.salesTable}>
                        <thead>
                          <tr><th>#</th><th>Company</th><th>Revenue</th><th>%</th></tr>
                        </thead>
                        <tbody>
                          {salesData.byCompany.map((item, i) => (
                            <tr key={item.name}>
                              <td className={styles.rankCell}>{i + 1}</td>
                              <td className={styles.nameCell}>{item.name}</td>
                              <td className={styles.revenueCell}>৳{item.revenue.toLocaleString()}</td>
                              <td className={styles.pctCell}>{Math.round((item.revenue / salesData.summary.totalRevenue) * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={styles.salesCard}>
                    <h3 className={styles.salesCardTitle}>Revenue by Category</h3>
                    <div className={styles.salesTableWrap}>
                      <table className={styles.salesTable}>
                        <thead>
                          <tr><th>#</th><th>Category</th><th>Revenue</th><th>%</th></tr>
                        </thead>
                        <tbody>
                          {salesData.byCategory.map((item, i) => (
                            <tr key={item.name}>
                              <td className={styles.rankCell}>{i + 1}</td>
                              <td className={styles.nameCell}>{item.name}</td>
                              <td className={styles.revenueCell}>৳{item.revenue.toLocaleString()}</td>
                              <td className={styles.pctCell}>{Math.round((item.revenue / salesData.summary.totalRevenue) * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === TABS.USERS && (
          <>
            <h1 className={styles.pageTitle}>All Users</h1>
            <div className={styles.filterBar}>
              <div className={styles.searchForm}>
                <input type="text" placeholder="Search by name or email..." value={userFilters.search}
                  onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value })}
                  className={styles.searchInput} />
                <button onClick={() => fetchUsers()} className={styles.searchBtn}>Search</button>
              </div>
              <div className={styles.filterGroup}>
                <select value={userFilters.role} onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value })}
                  className={styles.filterSelect}>
                  <option value="">All Roles</option>
                  <option value="customer">Customer</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {loading ? (
              <div className={styles.loadingCell}>Loading users...</div>
            ) : users.length === 0 ? (
              <div className={styles.loadingCell}>No users found</div>
            ) : (
              <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Orders</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className={styles.nameCell}>{u.name}</td>
                          <td>{u.email}</td>
                          <td><span className={`${styles.roleBadge} ${u.role === 'admin' ? styles.roleAdmin : u.role === 'pharmacist' ? styles.rolePharm : styles.roleCustomer}`}>{u.role}</span></td>
                          <td>{u.orderCount}</td>
                          <td className={styles.cellSub}>{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td>
                            <select
                              value={u.role}
                              onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                              className={styles.inlineSelect}
                            >
                              <option value="customer">Customer</option>
                              <option value="pharmacist">Pharmacist</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MedicineTable({
  medicines, loading, page, totalPages, setPage, search, setSearch, handleSearch,
  openEditModal, setDeleteConfirm, stockEditId, setStockEditId,
  stockValue, setStockValue, handleStockUpdate, formatPrice,
  medFilters, handleMedFilterChange, categories,
}) {
  const filtered = medicines.filter((m) => {
    if (medFilters.stockFilter === 'low' && (m.stockQuantity <= 0 || m.stockQuantity > 10)) return false;
    if (medFilters.stockFilter === 'in' && m.stockQuantity <= 0) return false;
    if (medFilters.stockFilter === 'out' && m.stockQuantity !== 0) return false;
    return true;
  });

  return (
    <>
      <div className={styles.filterBar}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input type="text" placeholder="Search medicines..." value={search}
            onChange={(e) => setSearch(e.target.value)} className={styles.searchInput} />
          <button type="submit" className={styles.searchBtn}>Search</button>
        </form>
        <div className={styles.filterGroup}>
          <select value={medFilters.categoryId} onChange={(e) => { handleMedFilterChange('categoryId', e.target.value); }}
            className={styles.filterSelect}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={medFilters.requiresPrescription} onChange={(e) => { handleMedFilterChange('requiresPrescription', e.target.value); }}
            className={styles.filterSelect}>
            <option value="">All Types</option>
            <option value="true">Prescription Required</option>
            <option value="false">OTC</option>
          </select>
          <select value={medFilters.stockFilter} onChange={(e) => { handleMedFilterChange('stockFilter', e.target.value); }}
            className={styles.filterSelect}>
            <option value="">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="in">In Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Prescription</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className={styles.loadingCell}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className={styles.loadingCell}>No medicines found</td></tr>
            ) : (
              filtered.map((med) => (
                <tr key={med.id}>
                  <td className={styles.nameCell}>{med.name}</td>
                  <td>{med.category?.name || '-'}</td>
                  <td>{formatPrice(med.price)}</td>
                  <td>
                    {stockEditId === med.id ? (
                      <div className={styles.stockEdit}>
                        <input type="number" value={stockValue} onChange={(e) => setStockValue(e.target.value)} className={styles.stockInput} min="0" />
                        <button onClick={() => handleStockUpdate(med.id)} className={styles.saveBtn}>Save</button>
                        <button onClick={() => { setStockEditId(null); setStockValue(''); }} className={styles.cancelBtn}>X</button>
                      </div>
                    ) : (
                      <span className={`${styles.stockBadge} ${med.stockQuantity <= 10 ? styles.stockLow : ''}`}
                        onClick={() => { setStockEditId(med.id); setStockValue(med.stockQuantity); }} style={{ cursor: 'pointer' }}>
                        {med.stockQuantity}
                      </span>
                    )}
                  </td>
                  <td>{med.requiresPrescription ? 'Yes' : 'No'}</td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button onClick={() => openEditModal(med.id)} className={styles.editBtn}>Edit</button>
                      <button onClick={() => setDeleteConfirm(med.id)} className={styles.deleteBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={styles.pageBtn}>Prev</button>
          <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={styles.pageBtn}>Next</button>
        </div>
      )}
    </>
  );
}

export default AdminDashboard;
