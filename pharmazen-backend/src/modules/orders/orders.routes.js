const express = require('express');
const router = express.Router();
const ordersController = require('./orders.controller');
const { authenticate } = require('../../middleware/auth');

router.post('/', authenticate, ordersController.createOrder);
router.get('/', authenticate, ordersController.getUserOrders);
router.get('/:orderId', authenticate, ordersController.getOrderById);
router.put('/:orderId/cancel', authenticate, ordersController.cancelOrder);

module.exports = router;
