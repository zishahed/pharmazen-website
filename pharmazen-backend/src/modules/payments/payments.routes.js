const express = require('express');
const router = express.Router();
const paymentsController = require('./payments.controller');
const { authenticate } = require('../../middleware/auth');

router.post('/create', authenticate, paymentsController.createPayment);
router.post('/execute', authenticate, paymentsController.executePayment);
router.get('/query/:paymentId', authenticate, paymentsController.queryPayment);
router.get('/status/:orderId', authenticate, paymentsController.getPaymentStatus);
router.get('/bkash/callback', paymentsController.bkashCallback);

module.exports = router;
