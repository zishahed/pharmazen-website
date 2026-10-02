const prisma = require('../../utils/prisma');
const { resolveSensitive, sensitiveWriteFields } = require('../../utils/sensitive');

/**
 * Shared visibility guard for every catalogue read path.
 *
 * Phase 1A shipped this while nothing was soft-deleted, so it was inert then.
 * Phase 1B makes it load-bearing: `deleteMedicine` now flips `is_deleted`
 * instead of removing the row, and this filter is the only thing keeping those
 * rows out of the catalogue. Do not remove, and do not add a medicine read
 * path that omits it.
 */
const NOT_DELETED = { isDeleted: false };

/**
 * Get medicines with filters, search, and pagination
 * @param {Object} params - Query parameters
 * @returns {Object} - { medicines, total, page, totalPages }
 */
async function getMedicines(params) {
  const { page = 1, limit = 20, genericName, company, categoryId, minPrice, maxPrice, search, requiresPrescription, isSensitive } = params;

  // Phase 7 step 1: resolve which column the caller is asking about up front,
  // so the `hasFilters` check and the actual filter cannot disagree.
  const sensitiveFilter = resolveSensitive({ requiresPrescription, isSensitive });

  // Check if any filters are applied
  const hasFilters = !!(genericName || company || categoryId || minPrice || maxPrice || search || sensitiveFilter !== undefined);

  // Build where clause
  const where = { ...NOT_DELETED };

  // Search by medicine name
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  // Filter by generic name and company
  // Both need to be present in description (AND condition)
  if (genericName && company) {
    // Both filters: use AND with individual contains checks
    where.AND = [
      { description: { contains: genericName, mode: 'insensitive' } },
      { description: { contains: company, mode: 'insensitive' } }
    ];
  } else if (genericName) {
    // Only generic name filter
    where.description = { contains: genericName, mode: 'insensitive' };
  } else if (company) {
    // Only company filter
    where.description = { contains: company, mode: 'insensitive' };
  }

  // Filter by category
  if (categoryId) {
    where.categoryId = categoryId;
  }

  // Filter by prescription requirement.
  // Phase 7 step 1: filters on the authoritative `isSensitive` column.
  // `sensitiveFilter` was resolved at the top of this function from either the
  // legacy `requiresPrescription` query param (still sent by AdminDashboard) or
  // `isSensitive`, so no caller can filter the two columns inconsistently.
  if (sensitiveFilter !== undefined) {
    where.isSensitive = sensitiveFilter;
  }

  // Filter by price range
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  // Determine ordering
  // When filters applied: sort by name (ascending)
  // When no filters: order by creation date (pseudo-random initial load)
  const orderBy = hasFilters ? { name: 'asc' } : { createdAt: 'desc' };

  try {
    // Execute queries in parallel
    const [medicines, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        include: {
          category: true,
        },
        orderBy,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.medicine.count({ where }),
    ]);

    return {
      medicines,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    };
  } catch (error) {
    console.error('Error fetching medicines:', error);
    throw new Error('Failed to fetch medicines from database');
  }
}

/**
 * Get maximum medicine price for price slider
 * @returns {Number} - Maximum price
 */
async function getMaxPrice() {
  try {
    const result = await prisma.medicine.aggregate({
      where: NOT_DELETED,
      _max: {
        price: true,
      },
    });

    return result._max.price || 10000; // Default to 10000 if no medicines
  } catch (error) {
    console.error('Error fetching max price:', error);
    throw new Error('Failed to fetch maximum price');
  }
}

/**
 * Get unique filter options (generic names and companies)
 * Parses description field to extract values
 * @returns {Object} - { genericNames, companies }
 */
async function getFilterOptions() {
  try {
    // Get all medicines with descriptions
    const medicines = await prisma.medicine.findMany({
      where: NOT_DELETED,
      select: {
        description: true,
      },
    });

    const genericNamesSet = new Set();
    const companiesSet = new Set();

    // Parse descriptions to extract generic names and companies
    medicines.forEach((medicine) => {
      if (medicine.description) {
        const parts = medicine.description.split('|').map((part) => part.trim());

        // Generic Name is 1st part
        if (parts[0]) {
          genericNamesSet.add(parts[0]);
        }

        // Company/Manufacturer is 4th part
        if (parts[3]) {
          companiesSet.add(parts[3]);
        }
      }
    });

    // Convert sets to sorted arrays
    const genericNames = Array.from(genericNamesSet).sort();
    const companies = Array.from(companiesSet).sort();

    return {
      genericNames,
      companies,
    };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    throw new Error('Failed to fetch filter options');
  }
}

/**
 * Get medicines that require prescription (restricted medicines)
 * @param {String} search - Optional search filter
 * @returns {Array} - Array of restricted medicines
 */
async function getRestrictedMedicines(search) {
  try {
    const where = {
      // Phase 7 step 1: the authoritative column, so this list and the order
      // gate can never disagree about which medicines are restricted.
      isSensitive: true,
      ...NOT_DELETED,
    };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const medicines = await prisma.medicine.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
      take: 50,
    });

    return medicines;
  } catch (error) {
    console.error('Error fetching restricted medicines:', error);
    throw new Error('Failed to fetch restricted medicines');
  }
}

async function getMedicineById(id) {
  try {
    // Intentionally NOT filtered by isDeleted. This route is admin-only, and
    // Phase 1B needs it to keep resolving a soft-deleted medicine so the
    // restore endpoint and the edit form still work on one.
    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: { category: true },
    });
    return medicine;
  } catch (error) {
    console.error('Error fetching medicine by ID:', error);
    throw new Error('Failed to fetch medicine');
  }
}

async function createMedicine(data) {
  try {
    const medicine = await prisma.medicine.create({
      data: {
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId,
        price: parseFloat(data.price),
        stockQuantity: parseInt(data.stockQuantity),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        // Phase 7 step 1: writes both columns. Accepts the legacy
        // `requiresPrescription` the React admin form still posts.
        ...sensitiveWriteFields(data),
      },
      include: { category: true },
    });
    return medicine;
  } catch (error) {
    console.error('Error creating medicine:', error);
    throw new Error('Failed to create medicine');
  }
}

async function updateMedicine(id, data) {
  try {
    const medicine = await prisma.medicine.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.price !== undefined && { price: parseFloat(data.price) }),
        ...(data.stockQuantity !== undefined && { stockQuantity: parseInt(data.stockQuantity) }),
        ...(data.expiryDate !== undefined && { expiryDate: data.expiryDate ? new Date(data.expiryDate) : null }),
        // Phase 7 step 1: spreads to `{}` when neither name is supplied, so a
        // partial update that omits the field leaves both columns untouched.
        ...sensitiveWriteFields(data),
      },
      include: { category: true },
    });
    return medicine;
  } catch (error) {
    console.error('Error updating medicine:', error);
    throw new Error('Failed to update medicine');
  }
}

/**
 * Soft delete a medicine (Phase 1B).
 *
 * This was `prisma.medicine.delete(...)`, which could not actually succeed for
 * any medicine in use: `CartItem.medicine` and `OrderItem.medicine` declare no
 * `onDelete`, so Postgres enforces RESTRICT, the FK blocks the delete, and the
 * handler rethrew 'Failed to delete medicine'. Admins could not delete a sold
 * medicine at all — the old 500 was a bug, not a guard.
 *
 * Flipping a flag removes that obstacle, so deletes now succeed everywhere.
 * That is the intended improvement, but it is also why the cart write paths
 * needed guarding (see cart.service.js): the FK was accidentally doing the
 * work that `isDeleted` filters now do explicitly.
 *
 * The row is kept rather than removed because a `?since=` cursor can never
 * observe a physically deleted row. A hard delete makes the deletion invisible
 * to every device that already synced that medicine — they would keep serving
 * it from their local SQLite copy forever. The flag is the change signal.
 *
 * Idempotent: a repeated DELETE reports success instead of throwing P2025, and
 * the `isDeleted: false` guard means a repeat does not write at all — a no-op
 * delete must not bump `updated_at`, or every retry becomes a sync delta for
 * 21k clients.
 *
 * @param {String} id - Medicine UUID
 * @returns {Object|null} The medicine, or null if no such id exists.
 */
async function deleteMedicine(id) {
  try {
    await prisma.medicine.updateMany({
      where: { id, ...NOT_DELETED },
      data: { isDeleted: true },
    });

    // Read back separately so a missing id is distinguishable from an
    // already-soft-deleted one, rather than inferred from the update count.
    // Unfiltered on purpose: the restore endpoint and the admin edit form both
    // need to resolve a soft-deleted medicine.
    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: { category: true },
    });

    return medicine;
  } catch (error) {
    console.error('Error soft-deleting medicine:', error);
    throw new Error('Failed to delete medicine');
  }
}

/**
 * Reverse a soft delete (Phase 1B).
 *
 * Added because soft delete is now the only delete an admin has: the FK
 * obstacle that used to make in-use medicines undeletable is gone, so a
 * mis-click needs a way back that does not require hand-editing Neon.
 *
 * Idempotent in the same direction as delete — restoring a live medicine is a
 * no-op that leaves `updated_at` alone. When it does write, the bumped
 * `updated_at` is what resurfaces the medicine on already-synced devices.
 *
 * @param {String} id - Medicine UUID
 * @returns {Object|null} The medicine, or null if no such id exists.
 */
async function restoreMedicine(id) {
  try {
    await prisma.medicine.updateMany({
      where: { id, isDeleted: true },
      data: { isDeleted: false },
    });

    const medicine = await prisma.medicine.findUnique({
      where: { id },
      include: { category: true },
    });

    return medicine;
  } catch (error) {
    console.error('Error restoring medicine:', error);
    throw new Error('Failed to restore medicine');
  }
}

async function updateStock(id, quantity) {
  try {
    const medicine = await prisma.medicine.update({
      where: { id },
      data: { stockQuantity: parseInt(quantity) },
      include: { category: true },
    });
    return medicine;
  } catch (error) {
    console.error('Error updating stock:', error);
    throw new Error('Failed to update stock');
  }
}

module.exports = {
  getMedicines,
  getMaxPrice,
  getFilterOptions,
  getRestrictedMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  restoreMedicine,
  updateStock,
};
