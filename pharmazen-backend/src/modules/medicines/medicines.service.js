const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get medicines with filters, search, and pagination
 * @param {Object} params - Query parameters
 * @returns {Object} - { medicines, total, page, totalPages }
 */
async function getMedicines(params) {
  const { page = 1, limit = 20, genericName, company, categoryId, minPrice, maxPrice, search } = params;

  // Check if any filters are applied
  const hasFilters = !!(genericName || company || categoryId || minPrice || maxPrice || search);

  // Build where clause
  const where = {};

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

module.exports = {
  getMedicines,
  getMaxPrice,
  getFilterOptions,
};
