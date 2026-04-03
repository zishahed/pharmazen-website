const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const createOrderFromCart = async (userId) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          medicine: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const hasPrescriptionRequired = cart.items.some(
    item => item.medicine.requiresPrescription
  );

  let orderStatus = 'pending';
  let prescriptionId = null;

  if (hasPrescriptionRequired) {
    const pendingPrescription = await prisma.prescription.findFirst({
      where: {
        userId,
        status: 'approved',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pendingPrescription) {
      orderStatus = 'awaiting_prescription';
    } else {
      prescriptionId = pendingPrescription.id;
    }
  }

  const totalAmount = cart.items.reduce((sum, item) => {
    return sum + (Number(item.medicine.price) * item.quantity);
  }, 0);

  const order = await prisma.order.create({
    data: {
      userId,
      totalAmount,
      status: orderStatus,
      paymentStatus: 'unpaid',
      prescriptionId,
      items: {
        create: cart.items.map(item => ({
          medicineId: item.medicine.id,
          quantity: item.quantity,
          priceAtPurchase: item.medicine.price,
        })),
      },
    },
    include: {
      items: {
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
      },
      prescription: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  return {
    id: order.id,
    totalAmount: Number(order.totalAmount),
    status: order.status,
    paymentStatus: order.paymentStatus,
    requiresPrescription: hasPrescriptionRequired,
    prescriptionRequired: hasPrescriptionRequired && !prescriptionId,
    items: order.items.map(item => ({
      medicineId: item.medicine.id,
      name: item.medicine.name,
      quantity: item.quantity,
      price: Number(item.priceAtPurchase),
      subtotal: Number(item.priceAtPurchase) * item.quantity,
    })),
  };
};

const getOrders = async (userId) => {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      payment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map(order => ({
    id: order.id,
    totalAmount: Number(order.totalAmount),
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    items: order.items.map(item => ({
      medicineId: item.medicine.id,
      name: item.medicine.name,
      quantity: item.quantity,
      price: Number(item.priceAtPurchase),
    })),
    payment: order.payment ? {
      transactionId: order.payment.transactionId,
      status: order.payment.status,
    } : null,
  }));
};

const getOrderById = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId, userId },
    include: {
      items: {
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      payment: true,
      prescription: true,
    },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  return {
    id: order.id,
    totalAmount: Number(order.totalAmount),
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    items: order.items.map(item => ({
      medicineId: item.medicine.id,
      name: item.medicine.name,
      quantity: item.quantity,
      price: Number(item.priceAtPurchase),
      subtotal: Number(item.priceAtPurchase) * item.quantity,
    })),
    payment: order.payment ? {
      transactionId: order.payment.transactionId,
      status: order.payment.status,
      bkashPaymentId: order.payment.bkashPaymentId,
    } : null,
    prescription: order.prescription ? {
      id: order.prescription.id,
      status: order.prescription.status,
      fileUrl: order.prescription.fileUrl,
    } : null,
  };
};

const cancelOrder = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId, userId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.paymentStatus === 'paid') {
    throw new Error('Cannot cancel a paid order');
  }

  if (order.status === 'cancelled') {
    throw new Error('Order already cancelled');
  }

  return await prisma.order.update({
    where: { id: orderId },
    data: { status: 'cancelled' },
  });
};

module.exports = {
  createOrderFromCart,
  getOrders,
  getOrderById,
  cancelOrder,
};
