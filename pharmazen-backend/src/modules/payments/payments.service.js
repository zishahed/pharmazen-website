const crypto = require('crypto');
const bkashService = require('../../services/bkash/bkash.service');
const prisma = require('../../utils/prisma');

const createPaymentSession = async (userId, orderId, amount) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.paymentStatus === 'paid') {
    throw new Error('Order already paid');
  }

  const requestedAmount = Number(amount);
  if (!Number.isFinite(requestedAmount) || requestedAmount !== Number(order.totalAmount)) {
    throw new Error('Payment amount does not match the order total');
  }

  if (order.status === 'awaiting_prescription') {
    throw new Error('Cannot pay for this order. Prescription approval required.');
  }

  const merchantInvoiceNumber = `PHZ${orderId.replace(/-/g, '').substring(0, 12)}${Date.now()}`;

  const bkashResponse = await bkashService.createPayment(
    amount.toString(),
    merchantInvoiceNumber
  );

  if (!bkashResponse.payment_id) {
    throw new Error('bKash did not return a payment ID');
  }

  // transaction_id is unique in PostgreSQL. It is not known until bKash
  // executes the payment, so use a unique internal reference instead of the
  // empty string placeholder. The real transaction ID replaces it on success.
  const pendingTransactionId = `pending_${crypto.randomUUID()}`;
  const existingPayment = await prisma.payment.findUnique({
    where: { orderId: order.id },
    select: { id: true, status: true },
  });

  if (existingPayment?.status === 'completed') {
    throw new Error('Order already paid');
  }

  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        bkashPaymentId: bkashResponse.payment_id,
        transactionId: pendingTransactionId,
        amount: requestedAmount,
        status: 'initiated',
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        bkashPaymentId: bkashResponse.payment_id,
        transactionId: pendingTransactionId,
        amount: requestedAmount,
        status: 'initiated',
      },
    });
  }

  return {
    bkashUrl: bkashResponse.gatewayPageURL || bkashResponse.payment_id,
    paymentId: bkashResponse.payment_id,
    merchantInvoiceNumber,
    amount: amount,
    isMock: bkashService.IS_MOCK,
  };
};

const executePayment = async (userId, paymentId) => {
  const payment = await prisma.payment.findFirst({
    where: { bkashPaymentId: paymentId },
    include: {
      order: {
        include: { items: true }
      }
    },
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  // The public bKash callback has no application bearer token. Ownership is
  // established by the payment ID stored for this order, while the
  // authenticated endpoint still enforces the caller's user ID.
  if (userId !== null && payment.order.userId !== userId) {
    throw new Error('Unauthorized');
  }

  if (payment.status === 'completed') {
    return {
      success: true,
      transactionId: payment.transactionId,
      status: 'already_completed',
    };
  }

  const bkashResponse = await bkashService.executePayment(paymentId);

  if (bkashResponse.transactionStatus === 'Completed' || bkashResponse.status === 'success') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        transactionId: bkashResponse.trx_id || bkashResponse.transactionId,
        status: 'completed',
      },
    });

    await prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: 'paid',
        status: 'paid',
      },
    });

    await prisma.medicine.updateMany({
      where: {
        id: {
          in: payment.order.items.map(item => item.medicineId)
        }
      },
      data: {
        stockQuantity: {
          decrement: 0
        }
      }
    });

    for (const item of payment.order.items) {
      await prisma.medicine.update({
        where: { id: item.medicineId },
        data: {
          stockQuantity: {
            decrement: item.quantity
          }
        }
      });
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: payment.order.userId },
      select: { id: true },
    });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return {
      success: true,
      transactionId: bkashResponse.trx_id || bkashResponse.transactionId,
      orderId: payment.orderId,
    };
  }

  return {
    success: false,
    status: bkashResponse.statusMessage || 'Payment failed',
  };
};

const queryPayment = async (paymentId) => {
  const payment = await prisma.payment.findFirst({
    where: { bkashPaymentId: paymentId },
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  const bkashResponse = await bkashService.queryPayment(paymentId);

  return {
    paymentId: bkashResponse.payment_id,
    status: bkashResponse.state || bkashResponse.transactionStatus,
    transactionId: bkashResponse.trx_id,
    amount: bkashResponse.amount,
    isMock: bkashService.IS_MOCK,
  };
};

const handleCallback = async (paymentId) => {
  return await executePayment(null, paymentId);
};

const getPaymentByOrderId = async (orderId) => {
  return await prisma.payment.findUnique({
    where: { orderId },
  });
};

module.exports = {
  createPaymentSession,
  executePayment,
  queryPayment,
  handleCallback,
  getPaymentByOrderId,
};
