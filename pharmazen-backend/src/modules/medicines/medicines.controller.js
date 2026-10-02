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
      requiresPrescription: req.query.requiresPrescription,
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

/**
 * GET /api/medicines/restricted
 * Get medicines that require prescription
 */
async function getRestrictedMedicines(req, res) {
  try {
    const search = req.query.search || '';
    const medicines = await medicinesService.getRestrictedMedicines(search);

    res.json({
      success: true,
      data: medicines,
    });
  } catch (error) {
    console.error('Error in getRestrictedMedicines controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch restricted medicines.',
    });
  }
}

async function getMedicineById(req, res) {
  try {
    const medicine = await medicinesService.getMedicineById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (error) {
    console.error('Error in getMedicineById controller:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch medicine.' });
  }
}

async function createMedicine(req, res) {
  try {
    const medicine = await medicinesService.createMedicine(req.body);
    res.status(201).json({ success: true, data: medicine });
  } catch (error) {
    console.error('Error in createMedicine controller:', error);
    res.status(500).json({ success: false, error: 'Failed to create medicine.' });
  }
}

async function updateMedicine(req, res) {
  try {
    const medicine = await medicinesService.updateMedicine(req.params.id, req.body);
    res.json({ success: true, data: medicine });
  } catch (error) {
    console.error('Error in updateMedicine controller:', error);
    res.status(500).json({ success: false, error: 'Failed to update medicine.' });
  }
}

/**
 * DELETE /api/medicines/:id
 * Soft delete a medicine.
 *
 * The `data` key is additive — the website's admin UI reads `success` only, so
 * this response shape is unchanged for it. It is here so an admin console can
 * confirm which row was affected, since the delete is now reversible.
 */
async function deleteMedicine(req, res) {
  try {
    const medicine = await medicinesService.deleteMedicine(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: 'Medicine not found' });
    }
    res.json({
      success: true,
      message: 'Medicine deleted successfully',
      data: medicine,
    });
  } catch (error) {
    console.error('Error in deleteMedicine controller:', error);
    res.status(500).json({ success: false, error: 'Failed to delete medicine.' });
  }
}

async function updateStock(req, res) {
  try {
    const medicine = await medicinesService.updateStock(req.params.id, req.body.stockQuantity);
    res.json({ success: true, data: medicine });
  } catch (error) {
    console.error('Error in updateStock controller:', error);
    res.status(500).json({ success: false, error: 'Failed to update stock.' });
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
  updateStock,
};
