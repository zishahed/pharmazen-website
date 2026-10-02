const cartService = require('./cart.service');

async function getCart(req, res) {
  try {
    const userId = req.user.id;
    console.log('Getting cart for user:', userId);
    const cart = await cartService.getCart(userId);
    console.log('Cart fetched:', cart);

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in getCart controller:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch cart'
    });
  }
}

async function addToCart(req, res) {
  try {
    const userId = req.user.id;
    const { medicineId, quantity = 1 } = req.body;

    if (!medicineId) {
      return res.status(400).json({
        success: false,
        error: 'Medicine ID is required'
      });
    }

    console.log('Adding to cart:', { userId, medicineId, quantity });
    const cart = await cartService.addToCart(userId, medicineId, quantity);
    console.log('Cart updated:', cart);

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in addToCart controller:', error);
    // `error.status` carries 404 for a stale reference to a soft-deleted
    // medicine (see cart.service.assertMedicineAvailable). Without it that
    // would be reported as a 500 and read as an outage.
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to add item to cart'
    });
  }
}

async function updateCartItem(req, res) {
  try {
    const userId = req.user.id;
    const { medicineId, quantity } = req.body;

    if (!medicineId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Medicine ID and quantity are required'
      });
    }

    const cart = await cartService.updateCartItemQuantity(userId, medicineId, quantity);

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in updateCartItem controller:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to update cart item'
    });
  }
}

async function removeFromCart(req, res) {
  try {
    const userId = req.user.id;
    const { medicineId } = req.params;

    if (!medicineId) {
      return res.status(400).json({
        success: false,
        error: 'Medicine ID is required'
      });
    }

    const cart = await cartService.removeFromCart(userId, medicineId);

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in removeFromCart controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove item from cart'
    });
  }
}

async function clearCart(req, res) {
  try {
    const userId = req.user.id;
    const cart = await cartService.clearCart(userId);

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error in clearCart controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cart'
    });
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};
