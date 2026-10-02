const prisma = require('../../utils/prisma');
const medicinesService = require('../medicines/medicines.service');
const genericsService = require('../generics/generics.service');

async function getDashboardStats(req, res) {
  try {
    const [totalMedicines, totalOrders, totalUsers, pendingPrescriptions, lowStockCount] = await Promise.all([
      // Catalogue counts exclude soft-deleted rows. The sales analytics further
      // down deliberately does NOT filter: order history must survive a
      // soft delete, and OrderItem.priceAtPurchase is the record of truth.
      prisma.medicine.count({ where: { isDeleted: false } }),
      prisma.order.count(),
      prisma.user.count(),
      prisma.prescription.count({ where: { status: 'pending' } }),
      prisma.medicine.count({ where: { isDeleted: false, stockQuantity: { lte: 10 } } }),
    ]);

    const revenueResult = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'completed' },
    });

    res.json({
      success: true,
      data: {
        totalMedicines,
        totalOrders,
        totalUsers,
        pendingPrescriptions,
        lowStockCount,
        totalRevenue: revenueResult._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
}

async function getAllOrders(req, res) {
  try {
    const { search, status, paymentStatus } = req.query;
    const where = {};

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              medicine: { select: { id: true, name: true } },
            },
          },
          payment: { select: { transactionId: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    const formatted = orders.map((o) => ({
      id: o.id,
      customerName: o.user.name,
      customerEmail: o.user.email,
      totalAmount: Number(o.totalAmount),
      status: o.status,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({
        name: i.medicine.name,
        quantity: i.quantity,
        price: Number(i.priceAtPurchase),
      })),
      payment: o.payment,
    }));

    res.json({ success: true, data: { orders: formatted, total } });
  } catch (error) {
    console.error('Error in getAllOrders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
}

async function getAllUsers(req, res) {
  try {
    const { search, role } = req.query;
    const where = {};

    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      orderCount: u._count.orders,
    }));

    res.json({ success: true, data: { users: formatted, total: users.length } });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'awaiting_prescription', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid order status' });
    }
    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            medicine: { select: { id: true, name: true } },
          },
        },
        payment: { select: { transactionId: true, status: true } },
      },
    });
    res.json({
      success: true,
      data: {
        id: order.id,
        customerName: order.user.name,
        customerEmail: order.user.email,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        items: order.items.map((i) => ({
          name: i.medicine.name,
          quantity: i.quantity,
          price: Number(i.priceAtPurchase),
        })),
        payment: order.payment,
      },
    });
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
}

async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['customer', 'pharmacist', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    if (id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot change your own role' });
    }
    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        orderCount: user._count.orders,
      },
    });
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    res.status(500).json({ success: false, error: 'Failed to update user role' });
  }
}

async function getSalesAnalytics(req, res) {
  try {
    const paidOrders = await prisma.order.findMany({
      where: { paymentStatus: 'paid' },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
                description: true,
                categoryId: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const byMedicine = {};
    const byGeneric = {};
    const byCompany = {};
    const byCategory = {};
    let totalRevenue = 0;
    let totalItemsSold = 0;

    for (const order of paidOrders) {
      totalRevenue += Number(order.totalAmount);
      for (const item of order.items) {
        const qty = item.quantity;
        const lineTotal = Number(item.priceAtPurchase) * qty;
        totalItemsSold += qty;
        const med = item.medicine;

        const parts = med.description ? med.description.split('|').map((s) => s.trim()) : [];
        const genericName = parts[0] || 'Unknown';
        const company = parts[3] || 'Unknown';

        byMedicine[med.name] = (byMedicine[med.name] || 0) + lineTotal;
        byGeneric[genericName] = (byGeneric[genericName] || 0) + lineTotal;
        byCompany[company] = (byCompany[company] || 0) + lineTotal;

        const catName = med.category?.name || 'Uncategorized';
        byCategory[catName] = (byCategory[catName] || 0) + lineTotal;
      }
    }

    const toSortedArray = (obj) =>
      Object.entries(obj)
        .map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }))
        .sort((a, b) => b.revenue - a.revenue);

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders: paidOrders.length,
          totalItemsSold,
          averageOrderValue: paidOrders.length ? Math.round((totalRevenue / paidOrders.length) * 100) / 100 : 0,
        },
        byMedicine: toSortedArray(byMedicine),
        byGeneric: toSortedArray(byGeneric),
        byCompany: toSortedArray(byCompany),
        byCategory: toSortedArray(byCategory),
      },
    });
  } catch (error) {
    console.error('Error in getSalesAnalytics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sales analytics' });
  }
}

/**
 * POST /api/admin/medicines/:id/restore
 * Reverse a Phase 1B soft delete.
 *
 * Mounted under /api/admin, not /api/medicines, because that is the prefix
 * SYNC.md specifies for this endpoint. The write itself lives in
 * medicines.service.js with the rest of the medicine mutations, so there is
 * still exactly one place that knows how a soft delete is represented.
 */
async function restoreMedicine(req, res) {
  try {
    const medicine = await medicinesService.restoreMedicine(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }
    res.json({
      success: true,
      message: 'Medicine restored successfully',
      data: medicine,
    });
  } catch (error) {
    console.error('Error in restoreMedicine controller:', error);
    res.status(500).json({ success: false, error: 'Failed to restore medicine.' });
  }
}

/**
 * POST /api/admin/generics/:id/restore
 * Reverse a Phase 3 soft delete.
 *
 * Same shape and placement as restoreMedicine, and for the same reason: the
 * write lives in generics.service.js so there is one place that knows how a
 * generic soft delete is represented. The id is parsed here rather than in the
 * service because this module has no shared param helper and a bad segment must
 * be a 400, not a Prisma P2025 in a 500.
 */
async function restoreGeneric(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid generic id' });
    }

    const generic = await genericsService.restoreGeneric(id);
    if (!generic) {
      return res.status(404).json({ success: false, error: 'Generic not found' });
    }
    res.json({
      success: true,
      message: 'Generic restored successfully',
      data: generic,
    });
  } catch (error) {
    console.error('Error in restoreGeneric controller:', error);
    res.status(500).json({ success: false, error: 'Failed to restore generic.' });
  }
}

module.exports = { getDashboardStats, getAllOrders, getAllUsers, getSalesAnalytics, updateOrderStatus, updateUserRole, restoreMedicine, restoreGeneric };