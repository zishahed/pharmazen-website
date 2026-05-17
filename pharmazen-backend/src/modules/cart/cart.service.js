const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MAX_QUANTITY = 5;

async function getCart(userId) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              price: true,
              stockQuantity: true,
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
      requiresPrescription: item.medicine.requiresPrescription,
      quantity: item.quantity
    }))
  };
}

async function addToCart(userId, medicineId, quantity = 1) {
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
