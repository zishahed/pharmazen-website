const prisma = require('../../utils/prisma');
const {
  reserveUnits,
  releaseUnits,
  firstPrescriptionWithCapacity,
} = require('../../utils/prescriptionLimits');

const MAX_QUANTITY = 5;

const createOrderFromCart = async (userId) => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        where: { medicine: { isDeleted: false } },
        include: {
          medicine: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const overLimit = cart.items.find(item => item.quantity > MAX_QUANTITY);
  if (overLimit) {
    throw new Error(`Maximum ${MAX_QUANTITY} units allowed per medicine. "${overLimit.medicine.name}" exceeds the limit.`);
  }

  // Phase 7 step 1: the gate reads `isSensitive`, the authoritative column, to
  // match `getRestrictedMedicines`, the sync payload and the content hash. The
  // response below still answers `requiresPrescription` because the React
  // checkout reads that name today.
  const hasPrescriptionRequired = cart.items.some(
    item => item.medicine.isSensitive
  );

  let orderStatus = 'pending';
  let prescriptionId = null;

  // Phase 7b: units are claimed against the authorising prescription before the
  // order row is written, inside one transaction. Rolling the reservation back
  // with the order matters: a failed insert must not silently burn a patient's
  // dispensing allowance.
  //
  // `prescriptionByMedicineId` is what each order line records, so an order with
  // several restricted medicines attributes every line to the prescription that
  // actually covered it. `prescriptionId` on the order itself stays the singular
  // field the React frontend already reads.
  const prescriptionByMedicineId = new Map();

  const order = await prisma.$transaction(async (tx) => {
    if (hasPrescriptionRequired) {
      const now = new Date();
      const restrictedItems = cart.items.filter(item => item.medicine.isSensitive);

      for (const item of restrictedItems) {
        const medicineId = item.medicine.id;
        const needed = item.quantity;

        // Newest-first so a patient holding two live approvals spends the recent
        // one and leaves the older one intact for a later refill.
        const candidates = await tx.prescription.findMany({
          where: {
            userId,
            medicineId,
            status: 'approved',
            startDate: { lte: now },
            endDate: { gte: now },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (candidates.length === 0) {
          const medicine = await tx.medicine.findUnique({ where: { id: medicineId }, select: { name: true } });
          throw Object.assign(
            new Error(`Restricted medicine "${medicine?.name}" requires an approved prescription. Please upload a prescription for this medicine and wait for pharmacist approval.`),
            // 409, not 500: this is a legitimate business rejection, and the old
            // 500 made routine checkout refusals look like server outages in
            // error monitoring. The React checkout keys off `result.message`
            // (CheckoutPage.jsx:59) and never reads the status, so changing it is
            // safe -- but the message must keep the word "prescription" or the
            // warning banner stops appearing.
            { status: 409, prescriptionRequired: true, medicineName: medicine?.name }
          );
        }

        // Try each candidate until one can actually absorb the units. The
        // read-modify-write filter below picks the candidate; the guarded
        // UPDATE inside reserveUnits is what actually enforces the cap, so a
        // concurrent checkout that took the capacity first loses here and moves
        // on to the next prescription rather than overshooting.
        let reserved = null;
        const withCapacity = candidates.filter(
          (rx) => (rx.maxQuantity - rx.consumedQuantity) >= needed
        );

        for (const candidate of withCapacity) {
          if (await reserveUnits(tx, candidate.id, needed)) {
            reserved = candidate;
            break;
          }
        }

        if (!reserved) {
          const medicine = await tx.medicine.findUnique({ where: { id: medicineId }, select: { name: true } });
          // Distinguished from the "no prescription at all" case above: the
          // patient does hold an approval, it is simply spent. A client that
          // wants to say something more useful than "upload a prescription" can
          // branch on `prescriptionExhausted`. The message still contains
          // "prescription" so the existing website banner appears as before.
          throw Object.assign(
            new Error(`Your approved prescription for "${medicine?.name}" has already been used up. Please upload a new prescription to continue.`),
            { status: 409, prescriptionExhausted: true, medicineName: medicine?.name }
          );
        }

        prescriptionByMedicineId.set(medicineId, reserved.id);
        prescriptionId = reserved.id;
      }
    }

    const totalAmount = cart.items.reduce((sum, item) => {
      return sum + (Number(item.medicine.price) * item.quantity);
    }, 0);

    return tx.order.create({
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
            // Phase 7b: attribution, so cancelling returns units to the right
            // prescription and the audit trail records every authorising
            // prescription rather than just the last one.
            prescriptionId: prescriptionByMedicineId.get(item.medicine.id) ?? null,
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
  });

  return {
    id: order.id,
    totalAmount: Number(order.totalAmount),
    status: order.status,
    paymentStatus: order.paymentStatus,
    // Phase 7 step 1: emitted under both names so the React checkout keeps working
    // without a coordinated deploy. `requiresPrescription` here is derived from
    // the gate result rather than read from the row.
    requiresPrescription: hasPrescriptionRequired,
    isSensitive: hasPrescriptionRequired,
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
      prescription: {
        include: {
          files: {
            select: { fileUrl: true },
            take: 1,
          },
        },
      },
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
      fileUrl: order.prescription.files?.[0]?.fileUrl || null,
    } : null,
  };
};

const cancelOrder = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId, userId },
    include: {
      items: {
        select: { id: true, quantity: true, prescriptionId: true },
      },
    },
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

  // Phase 7b: the status flip is a conditional UPDATE and the units are
  // released only if it actually claimed the row. Doing both in one transaction
  // means two concurrent cancels cannot both see `status !== 'cancelled'` and
  // each hand the same units back.
  return await prisma.$transaction(async (tx) => {
    const cancelled = await tx.order.updateMany({
      where: { id: orderId, status: { not: 'cancelled' } },
      data: { status: 'cancelled' },
    });

    if (cancelled.count === 0) {
      throw new Error('Order already cancelled');
    }

    // Return each line's units to the prescription that authorised them, so a
    // cancelled order does not permanently consume a patient's allowance.
    const released = new Map();
    for (const item of order.items) {
      if (!item.prescriptionId) continue;
      released.set(item.prescriptionId, (released.get(item.prescriptionId) || 0) + item.quantity);
    }

    for (const [prescriptionId, quantity] of released) {
      await releaseUnits(tx, prescriptionId, quantity);
    }

    return tx.order.findUnique({ where: { id: orderId } });
  });
};

module.exports = {
  createOrderFromCart,
  getOrders,
  getOrderById,
  cancelOrder,
};
