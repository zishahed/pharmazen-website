const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authenticate } = require('../../middleware/auth');

router.get('/', authenticate, cartController.getCart);
router.post('/', authenticate, cartController.addToCart);
router.put('/', authenticate, cartController.updateCartItem);
router.delete('/', authenticate, cartController.clearCart);
router.delete('/:medicineId', authenticate, cartController.removeFromCart);

module.exports = router;
