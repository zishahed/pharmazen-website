const express = require('express');
const authController = require('./auth.controller');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);

// Admin-only routes
router.post('/admin/register-staff', authenticate, authorize('admin'), authController.registerStaff);

module.exports = router;
