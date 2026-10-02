const ordersService = require('./orders.service');

const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    const order = await ordersService.createOrderFromCart(userId);

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    // Phase 7b: honour error.status so a rejected checkout answers 409 instead of
    // 500. Defaults to 500, so every other failure path is unchanged. The
    // response shape only gains optional fields.
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to create order',
      ...(error.prescriptionRequired && { prescriptionRequired: true }),
      ...(error.prescriptionExhausted && { prescriptionExhausted: true }),
      ...(error.medicineName && { medicineName: error.medicineName }),
    });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await ordersService.getOrders(userId);

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get orders',
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const order = await ordersService.getOrderById(userId, orderId);

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(404).json({
      success: false,
      message: error.message || 'Order not found',
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    const order = await ordersService.cancelOrder(userId, orderId);

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel order',
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
};
