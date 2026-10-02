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

// Phase 1B — deleteMedicine is now a soft delete, so every delete needs a way back.
// The DELETE itself lives in medicines.routes.js with the other medicine CRUD.
router.post('/medicines/:id/restore', authenticate, authorize('admin'), adminController.restoreMedicine);

module.exports = router;