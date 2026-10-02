const genericsService = require('./generics.service');

/**
 * Parse the `:id` route param into an integer.
 *
 * `genericId` is an Int, so a non-numeric segment is a client mistake rather
 * than a missing row. Left unvalidated it reaches Prisma as a string and comes
 * back as P2025, which the catch-all below would report as a 500.
 *
 * @param {string} raw
 * @returns {number|null} The id, or null if it is not a positive integer.
 */
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/**
 * GET /api/generics
 * Admin listing with filters, search and pagination.
 */
async function getGenerics(req, res) {
  try {
    const result = await genericsService.getGenerics(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in getGenerics controller:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch generics.' });
  }
}

/**
 * GET /api/generics/:id
 *
 * Resolves soft-deleted generics too, so the edit form and the restore action
 * both have something to show.
 */
async function getGenericById(req, res) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid generic id' });
    }

    const generic = await genericsService.getGenericById(id);
    if (!generic) {
      return res.status(404).json({ success: false, error: 'Generic not found' });
    }
    res.json({ success: true, data: generic });
  } catch (error) {
    console.error('Error in getGenericById controller:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch generic.' });
  }
}

/**
 * POST /api/generics
 *
 * Only `genericName` is required. The 15 monograph description columns are all
 * nullable and `descriptions_count` is derived from them, so a sparse create is
 * a legitimate thing to want.
 */
async function createGeneric(req, res) {
  try {
    const { genericName } = req.body || {};
    if (!genericName || !String(genericName).trim()) {
      return res.status(400).json({ success: false, error: 'genericName is required' });
    }

    const generic = await genericsService.createGeneric(req.body);
    res.status(201).json({
      success: true,
      message: 'Generic created successfully',
      data: generic,
    });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ success: false, error: error.message });
    }
    console.error('Error in createGeneric controller:', error);
    res.status(500).json({ success: false, error: 'Failed to create generic.' });
  }
}

/**
 * PUT /api/generics/:id
 */
async function updateGeneric(req, res) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid generic id' });
    }

    const generic = await genericsService.updateGeneric(id, req.body || {});
    if (!generic) {
      return res.status(404).json({ success: false, error: 'Generic not found' });
    }
    res.json({ success: true, data: generic });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ success: false, error: error.message });
    }
    console.error('Error in updateGeneric controller:', error);
    res.status(500).json({ success: false, error: 'Failed to update generic.' });
  }
}

/**
 * DELETE /api/generics/:id
 * Soft delete. Reversible via POST /api/admin/generics/:id/restore.
 */
async function deleteGeneric(req, res) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid generic id' });
    }

    const generic = await genericsService.deleteGeneric(id);
    if (!generic) {
      return res.status(404).json({ success: false, error: 'Generic not found' });
    }
    res.json({
      success: true,
      message: 'Generic deleted successfully',
      data: generic,
    });
  } catch (error) {
    console.error('Error in deleteGeneric controller:', error);
    res.status(500).json({ success: false, error: 'Failed to delete generic.' });
  }
}

module.exports = {
  getGenerics,
  getGenericById,
  createGeneric,
  updateGeneric,
  deleteGeneric,
};