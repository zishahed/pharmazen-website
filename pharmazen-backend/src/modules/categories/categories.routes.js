const express = require('express');
const router = express.Router();
const categoriesController = require('./categories.controller');

// GET /api/categories - Get all categories
router.get('/', categoriesController.getCategories);

module.exports = router;
