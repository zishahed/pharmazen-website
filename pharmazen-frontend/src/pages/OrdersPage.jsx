import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../api/orderApi';
import styles from './OrdersPage.module.css';

const STATUS_MAP = {
  pending: { label: 'Pending', className: 'statusPending' },
  awaiting_prescription: { label: 'Awaiting Prescription', className: 'statusAwaiting' },
  paid: { label: 'Paid', className: 'statusPaid' },
  cancelled: { label: 'Cancelled', className: 'statusCancelled' },
};

const PAYMENT_MAP = {
  unpaid: { label: 'Unpaid', className: 'paymentUnpaid' },
  paid: { label: 'Paid', className: 'paymentPaid' },
  failed: { label: 'Failed', className: 'paymentFailed' },
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isCustomer } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated() || !isCustomer()) {
      navigate('/unauthorized');
    }
  }, [isAuthenticated, isCustomer, navigate]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await orderApi.getOrders();
      setOrders(response.data);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancellingId(orderId);
    try {
      await orderApi.cancelOrder(orderId);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
    } catch (err) {
      console.error('Error cancelling order:', err);
      setError(err.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canCancel = (order) => {
    return order.status === 'pending' && order.paymentStatus !== 'paid';
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Orders</h1>
            <p className={styles.subtitle}>Track and manage your medicine orders</p>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
              <button className={styles.errorDismiss} onClick={() => setError('')}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className={styles.emptyState}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p>No orders yet</p>
              <button
                className={styles.shopBtn}
                onClick={() => navigate('/products')}
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className={styles.list}>
              {orders.map((order) => {
                const orderStatus = STATUS_MAP[order.status] || STATUS_MAP.pending;
                const paymentStatus = PAYMENT_MAP[order.paymentStatus] || PAYMENT_MAP.unpaid;

                return (
                  <div key={order.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardHeader}>
                        <div className={styles.orderIdRow}>
                          <span className={styles.orderIdLabel}>Order</span>
                          <span className={styles.orderId}>#{order.id.slice(0, 8)}</span>
                        </div>
                        <div className={styles.badges}>
                          <span className={`${styles.statusBadge} ${styles[orderStatus.className]}`}>
                            {orderStatus.label}
                          </span>
                          <span className={`${styles.statusBadge} ${styles[paymentStatus.className]}`}>
                            {paymentStatus.label}
                          </span>
                        </div>
                      </div>
                      <div className={styles.cardMeta}>
                        <div className={styles.metaItem}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                        <div className={styles.metaItem}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatTime(order.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardBody}>
                      <div className={styles.itemsList}>
                        {order.items.map((item, idx) => (
                          <div key={idx} className={styles.orderItem}>
                            <span className={styles.itemName}>{item.name}</span>
                            <span className={styles.itemQty}>x{item.quantity}</span>
                            <span className={styles.itemPrice}>৳{Number(item.price).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <div className={styles.totalRow}>
                        <span className={styles.totalLabel}>Total</span>
                        <span className={styles.totalAmount}>৳{Number(order.totalAmount).toFixed(2)}</span>
                      </div>
                      {canCancel(order) && (
                        <button
                          className={styles.cancelBtn}
                          onClick={() => handleCancel(order.id)}
                          disabled={cancellingId === order.id}
                        >
                          {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrdersPage;
