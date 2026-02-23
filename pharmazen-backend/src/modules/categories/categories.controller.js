const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * GET /api/categories
 * Get all categories sorted by name
 */
async function getCategories(req, res) {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc',
      },
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error in getCategories controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories.',
    });
  }
}

module.exports = {
  getCategories,
};
