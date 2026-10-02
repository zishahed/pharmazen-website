const prisma = require('../../utils/prisma');
const { toSensitiveDto } = require('../../utils/sensitive');

const MAX_QUANTITY = 5;

const NOT_DELETED = { isDeleted: false };

/**
 * Soft-deleted medicines are filtered out of the cart rather than surfaced as
 * unavailable. Phase 1B pairs this with a reconciliation query for carts that
 * still reference a soft-deleted medicine, otherwise a live cart can silently
 * shrink at checkout (see orders.service.createOrderFromCart, which applies
 * the same filter so the two paths can never disagree).
 */
async function getCart(userId) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        where: { medicine: NOT_DELETED },
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              price: true,
              stockQuantity: true,
              // Phase 7 step 1: `isSensitive` is the authoritative column; the
              // legacy mirror is still selected so `toSensitiveDto` can keep
              // answering both names until the column is dropped.
              isSensitive: true,
              requiresPrescription: true,
              categoryId: true,
              category: {
                select: { name: true }
              }
            }
          }
        }
      }
    }
  });

  if (!cart) {
    return { items: [] };
  }

  return {
    items: cart.items.map(item => ({
      id: item.medicine.id,
      name: item.medicine.name,
      genericName: item.medicine.category.name,
      price: Number(item.medicine.price),
      stockQuantity: item.medicine.stockQuantity,
      // Phase 7 step 1: served under both names from the authoritative column.
      // The React checkout still reads `requiresPrescription` (CheckoutPage),
      // so removing it here would silently drop the restricted warning.
      ...toSensitiveDto(item.medicine.isSensitive),
      quantity: item.quantity
    }))
  };
}

/**
 * Reject a cart write that targets a soft-deleted medicine.
 *
 * Phase 1A already hid soft-deleted rows from `getCart` and from
 * `createOrderFromCart`, but that filter was inert then, because a hard delete
 * failed the FK outright and no cart could ever reference a deleted medicine.
 * Phase 1B removes that obstacle: the row survives, so the FK is satisfied and
 * a stale product page could add the medicine straight back into the cart.
 * The next `getCart` would then hide it, which reaches the customer as a cart
 * that empties itself with no error anywhere.
 *
 * Writes that *remove* a row are deliberately not guarded: a customer must
 * always be able to clear an item they can see flagged, and
 * `updateCartItemQuantity` routes the quantity<=0 case to a delete.
 *
 * Throws with `status` so the controller can answer 404 rather than a 500 —
 * this is a client-side stale reference, not a server fault, and a 500 here
 * would look like an outage in error monitoring.
 *
 * @param {String} medicineId - Medicine UUID
 */
async function assertMedicineAvailable(medicineId) {
  const medicine = await prisma.medicine.findFirst({
    where: { id: medicineId, ...NOT_DELETED },
    select: { id: true },
  });

  if (!medicine) {
    const error = new Error('Medicine is no longer available');
    error.status = 404;
    throw error;
  }
}

async function addToCart(userId, medicineId, quantity = 1) {
  await assertMedicineAvailable(medicineId);

  let cart = await prisma.cart.findUnique({
    where: { userId }
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId }
    });
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_medicineId: {
        cartId: cart.id,
        medicineId
      }
    }
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;
    if (newQuantity > MAX_QUANTITY) {
      throw new Error(`Maximum ${MAX_QUANTITY} units allowed per medicine`);
    }
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity }
    });
  } else {
    if (quantity > MAX_QUANTITY) {
      throw new Error(`Maximum ${MAX_QUANTITY} units allowed per medicine`);
    }
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        medicineId,
        quantity
      }
    });
  }

  return getCart(userId);
}

async function updateCartItemQuantity(userId, medicineId, quantity) {
  const cart = await prisma.cart.findUnique({
    where: { userId }
  });

  if (!cart) {
    throw new Error('Cart not found');
  }

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        medicineId
      }
    });
  } else if (quantity > MAX_QUANTITY) {
    throw new Error(`Maximum ${MAX_QUANTITY} units allowed per medicine`);
  } else {
    await assertMedicineAvailable(medicineId);
    await prisma.cartItem.updateMany({
      where: {
        cartId: cart.id,
        medicineId
      },
      data: { quantity }
    });
  }

  return getCart(userId);
}

async function removeFromCart(userId, medicineId) {
  const cart = await prisma.cart.findUnique({
    where: { userId }
  });

  if (!cart) {
    return { items: [] };
  }

  await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
      medicineId
    }
  });

  return getCart(userId);
}

async function clearCart(userId) {
  const cart = await prisma.cart.findUnique({
    where: { userId }
  });

  if (!cart) {
    return { items: [] };
  }

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id }
  });

  return { items: [] };
}

module.exports = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart
};
