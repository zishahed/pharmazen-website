const express = require('express');
const router = express.Router();
const medicinesController = require('./medicines.controller');
const { authenticate, authorize } = require('../../middleware/auth');

// Public routes
// GET /api/medicines - Get medicines with filters and pagination
router.get('/', medicinesController.getMedicines);

// GET /api/medicines/max-price - Get maximum price
router.get('/max-price', medicinesController.getMaxPrice);

// GET /api/medicines/filters - Get filter options
router.get('/filters', medicinesController.getFilterOptions);

// GET /api/medicines/restricted - Get medicines that require prescription
router.get('/restricted', medicinesController.getRestrictedMedicines);

// Admin-only routes (must be after public routes to avoid param conflicts)
// GET /api/medicines/:id - Get single medicine by ID
router.get('/:id', authenticate, authorize('admin'), medicinesController.getMedicineById);

// POST /api/medicines - Create a new medicine
router.post('/', authenticate, authorize('admin'), medicinesController.createMedicine);

// PUT /api/medicines/:id - Update a medicine
router.put('/:id', authenticate, authorize('admin'), medicinesController.updateMedicine);

// DELETE /api/medicines/:id - Soft delete a medicine (Phase 1B).
// Reversible via POST /api/admin/medicines/:id/restore.
router.delete('/:id', authenticate, authorize('admin'), medicinesController.deleteMedicine);

// PATCH /api/medicines/:id/stock - Update stock quantity
router.patch('/:id/stock', authenticate, authorize('admin'), medicinesController.updateStock);

module.exports = router;
