const paymentsService = require('./payments.service');

const createPayment = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const userId = req.user.id;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'orderId and amount are required',
      });
    }

    const result = await paymentsService.createPaymentSession(userId, orderId, amount);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment session',
    });
  }
};

const executePayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'paymentId is required',
      });
    }

    const result = await paymentsService.executePayment(userId, paymentId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Execute payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute payment',
    });
  }
};

const queryPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'paymentId is required',
      });
    }

    const result = await paymentsService.queryPayment(paymentId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Query payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to query payment',
    });
  }
};

const bkashCallback = async (req, res) => {
  try {
    const { paymentId } = req.query;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'paymentId is required',
      });
    }

    const result = await paymentsService.handleCallback(paymentId);

    const redirectUrl = result.success
      ? `${process.env.FRONTEND_URL}/payment/success?orderId=${result.orderId}&trxId=${result.transactionId}`
      : `${process.env.FRONTEND_URL}/payment/failed`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('bKash callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed`);
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const payment = await paymentsService.getPaymentByOrderId(orderId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    const order = await require('@prisma/client').PrismaClient.prototype.$connect();
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const orderData = await prisma.order.findUnique({
      where: { id: orderId, userId },
    });

    if (!orderData) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: {
        orderId,
        paymentStatus: payment.status,
        transactionId: payment.transactionId,
        orderStatus: orderData.status,
        paymentStatus: orderData.paymentStatus,
      },
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get payment status',
    });
  }
};

module.exports = {
  createPayment,
  executePayment,
  queryPayment,
  bkashCallback,
  getPaymentStatus,
};
