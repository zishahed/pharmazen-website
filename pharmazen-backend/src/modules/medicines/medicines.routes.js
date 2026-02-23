const express = require('express');
const router = express.Router();
const medicinesController = require('./medicines.controller');

// GET /api/medicines - Get medicines with filters and pagination
router.get('/', medicinesController.getMedicines);

// GET /api/medicines/max-price - Get maximum price
router.get('/max-price', medicinesController.getMaxPrice);

// GET /api/medicines/filters - Get filter options
router.get('/filters', medicinesController.getFilterOptions);

module.exports = router;
