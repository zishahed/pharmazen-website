const medicinesService = require('./medicines.service');

/**
 * GET /api/medicines
 * Get medicines with filters, search, and pagination
 */
async function getMedicines(req, res) {
  try {
    const params = {
      page: req.query.page,
      limit: req.query.limit,
      genericName: req.query.genericName,
      company: req.query.company,
      categoryId: req.query.categoryId,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      search: req.query.search,
    };

    const result = await medicinesService.getMedicines(params);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in getMedicines controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medicines. Please try again.',
    });
  }
}

/**
 * GET /api/medicines/max-price
 * Get maximum medicine price for price range slider
 */
async function getMaxPrice(req, res) {
  try {
    const maxPrice = await medicinesService.getMaxPrice();

    res.json({
      success: true,
      data: { maxPrice },
    });
  } catch (error) {
    console.error('Error in getMaxPrice controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch maximum price.',
    });
  }
}

/**
 * GET /api/medicines/filters
 * Get filter options (generic names and companies)
 */
async function getFilterOptions(req, res) {
  try {
    const options = await medicinesService.getFilterOptions();

    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    console.error('Error in getFilterOptions controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options.',
    });
  }
}

module.exports = {
  getMedicines,
  getMaxPrice,
  getFilterOptions,
};
