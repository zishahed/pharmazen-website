const express = require('express');
const router = express.Router();
const genericsController = require('./generics.controller');
const { authenticate, authorize } = require('../../middleware/auth');

// Every route here is admin-only.
//
// Unlike /api/sync, generics are not part of the public catalogue surface: the
// React frontend derives generic names out of the denormalised medicine
// `description` string, and the app gets generics from /api/sync. So there is no
// public consumer, and leaving this closed means a soft-deleted generic has no
// anonymous reader to leak to.
//
// Middleware is applied per-route rather than with `router.use`, matching
// admin.routes.js. Kept that way so adding a public route later is a deliberate
// change to one line instead of a silent widening of every route in the file.

// GET /api/generics - List generics with filters and pagination
router.get('/', authenticate, authorize('admin'), genericsController.getGenerics);

// GET /api/generics/:id - Get a single generic, including a soft-deleted one
router.get('/:id', authenticate, authorize('admin'), genericsController.getGenericById);

// POST /api/generics - Create a generic; the id is assigned by the sequence
router.post('/', authenticate, authorize('admin'), genericsController.createGeneric);

// PUT /api/generics/:id - Update a generic
router.put('/:id', authenticate, authorize('admin'), genericsController.updateGeneric);

// DELETE /api/generics/:id - Soft delete. Reversible via
// POST /api/admin/generics/:id/restore, which lives with the other admin actions
// rather than here, matching how Phase 1B placed the medicine restore.
router.delete('/:id', authenticate, authorize('admin'), genericsController.deleteGeneric);

module.exports = router;