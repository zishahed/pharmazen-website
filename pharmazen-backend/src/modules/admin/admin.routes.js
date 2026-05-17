const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate, authorize } = require('../../middleware/auth');

router.get('/stats', authenticate, authorize('admin'), adminController.getDashboardStats);
router.get('/orders', authenticate, authorize('admin'), adminController.getAllOrders);
router.get('/users', authenticate, authorize('admin'), adminController.getAllUsers);
router.get('/sales', authenticate, authorize('admin'), adminController.getSalesAnalytics);
router.patch('/orders/:id/status', authenticate, authorize('admin'), adminController.updateOrderStatus);
router.patch('/users/:id/role', authenticate, authorize('admin'), adminController.updateUserRole);

module.exports = router;