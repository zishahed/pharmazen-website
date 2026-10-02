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

// Phase 3 — generics CRUD got the same soft delete, for a sharper reason: a hard
// delete would hit ON DELETE SET NULL on medicines.generic_id and break every
// device's generic resolution without emitting a medicine delta. The DELETE
// itself lives in generics.routes.js with the other generics CRUD.
router.post('/generics/:id/restore', authenticate, authorize('admin'), adminController.restoreGeneric);

module.exports = router;