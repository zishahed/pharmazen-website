const { PrismaClient } = require('@prisma/client');
const bkashService = require('../../services/bkash/bkash.service');

const prisma = new PrismaClient();

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

  const merchantInvoiceNumber = `PHZ${orderId.replace(/-/g, '').substring(0, 12)}${Date.now()}`;

  const bkashResponse = await bkashService.createPayment(
    amount.toString(),
    merchantInvoiceNumber
  );

  await prisma.payment.create({
    data: {
      orderId: order.id,
      bkashPaymentId: bkashResponse.payment_id,
      transactionId: '',
      amount: amount,
      status: 'initiated',
    },
  });

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

  if (payment.order.userId !== userId) {
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
