const prisma = require('../../utils/prisma');

/**
 * The 15 monograph description columns, in the order SYNC.md's hash expects.
 *
 * Ordered deliberately: `content_hash.js` derives its column list from the same
 * names, and the wire order is a contract with `sync_manifest.dart`. Reordering
 * here is safe, reordering there is not.
 */
const DESCRIPTION_COLUMNS = [
  'indicationDescription',
  'therapeuticClassDescription',
  'pharmacologyDescription',
  'dosageDescription',
  'administrationDescription',
  'interactionDescription',
  'contraindicationsDescription',
  'sideEffectsDescription',
  'pregnancyAndLactationDescription',
  'precautionsDescription',
  'pediatricUsageDescription',
  'overdoseEffectsDescription',
  'durationOfTreatmentDescription',
  'reconstitutionDescription',
  'storageConditionsDescription',
];

/** Scalar fields an admin may set, excluding the id and the bookkeeping columns. */
const EDITABLE_FIELDS = [
  'genericName',
  'slug',
  'monographLink',
  'drugClass',
  'indication',
  ...DESCRIPTION_COLUMNS,
];

/**
 * Shared visibility guard, mirroring `medicines.service.js`'s NOT_DELETED.
 *
 * Phase 1A put `is_deleted` on `generics` while nothing was soft-deleted, so it
 * was inert. Phase 3 makes it load-bearing for the same reason it did for
 * medicines: `deleteGeneric` flips the flag instead of dropping the row, and
 * this filter is the only thing keeping those rows out of the admin catalogue.
 *
 * Do not add a generic read path that omits it.
 */
const NOT_DELETED = { isDeleted: false };

/**
 * Count the populated description columns.
 *
 * `descriptions_count` is denormalised — the legacy source SQLite carried it and
 * `seed-sync-source.js` copied it across verbatim. It is not derived by anything
 * in this codebase, but it is *derivable*: verified against Neon, all 1,711
 * generics satisfy `descriptions_count = (count of non-empty description
 * columns)`, with values spanning 1..15.
 *
 * So it must be recomputed on every write. Leaving it stale would be worse than
 * cosmetic: it is one of the six identity fields in `computeGenericHash`, so a
 * generic whose text was edited but whose count was not would ship a hash that
 * does not describe its own content, and every device would flag it as
 * mismatched forever. Same obligation as open item #2 for medicines.description.
 *
 * @param {Object} values - A field bag, partial or complete.
 * @returns {number} How many description columns hold a non-empty string.
 */
function countDescriptions(values) {
  return DESCRIPTION_COLUMNS.reduce((total, column) => {
    const value = values[column];
    // `null`/`undefined` are "absent". An empty or whitespace-only string is
    // present-but-blank, which is not the same thing and does not count.
    return total + (typeof value === 'string' && value.trim() !== '' ? 1 : 0);
  }, 0);
}

/** Read a field bag from a stored row so counts are computed against what is
 *  actually persisted, not only against what the admin happened to send. */
function descriptionsOf(row) {
  const values = {};
  for (const column of DESCRIPTION_COLUMNS) values[column] = row[column];
  return values;
}

/** Normalise a submitted value: absent and blank collapse to null, so the column
 *  is cleared rather than storing "". The count above treats them the same. */
function normalize(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * Build the Prisma `data` for a create or update from a request body, dropping
 * unknown keys and computing `descriptionsCount` from the merged result.
 *
 * `existing` is supplied on update so that a body which omits a description
 * column does not silently clear it: absent means "leave alone", while an
 * explicit null or "" means "clear".
 *
 * @param {Object} body - Raw request body.
 * @param {Object|null} existing - The stored row on update; null on create.
 * @returns {Object} Prisma write payload.
 */
function buildData(body, existing) {
  const data = {};

  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    data[field] = normalize(body[field]);
  }

  if (existing) {
    // Copy the untouched description columns across so the count below reflects
    // the full post-update row rather than just the edited subset.
    for (const column of DESCRIPTION_COLUMNS) {
      if (!(column in data)) data[column] = normalize(existing[column]);
    }
  }

  data.descriptionsCount = countDescriptions(data);

  return data;
}

/**
 * Admin generics CRUD (Phase 3).
 *
 * Two things are deliberate here and worth not "fixing":
 *
 * 1. **Deletes are soft.** `medicines.generic_id` has `ON DELETE SET NULL`, so a
 *    hard delete of a generic would quietly null the FK on every medicine that
 *    points at it. No medicine row would change, so no medicine delta would be
 *    emitted, and every device's `GenericResolver` would find `generic_id = ?`
 *    missing and fall through to a negative stub id. A hard delete is therefore
 *    not merely discouraged here, it is destructive in a way the sync stream
 *    cannot report. The flag is the change signal instead.
 *
 * 2. **Repeats are no-ops.** `generic.updatedAt` carries `@updatedAt`, which
 *    Prisma applies even to an `updateMany` that matched nothing. Every write is
 *    a sync delta for all 1,711 generics' worth of devices, so the `isDeleted`
 *    guard lives in the `where` clause: deleting an already-deleted generic must
 *    not bump `updated_at` and manufacture a delta out of nothing.
 */

/**
 * Get generics with filters, search and pagination.
 *
 * @param {Object} params - Query parameters.
 * @returns {Object} - { generics, total, page, totalPages }
 */
async function getGenerics(params) {
  const { page = 1, limit = 20, search, drugClass, indication, includeDeleted } = params;

  const where = {};

  // Hidden by default, which is the whole point of the flag. `includeDeleted`
  // is admin-only (the entire route is) and exists so an admin can find and
  // restore something they deleted.
  if (includeDeleted !== 'true') {
    Object.assign(where, NOT_DELETED);
  }

  if (search) {
    where.genericName = { contains: search, mode: 'insensitive' };
  }
  if (drugClass) {
    where.drugClass = { contains: drugClass, mode: 'insensitive' };
  }
  if (indication) {
    where.indication = { contains: indication, mode: 'insensitive' };
  }

  // Name is the natural admin-facing order and it is unique, so it is a stable
  // sort with no tiebreaker needed.
  try {
    const [generics, total] = await Promise.all([
      prisma.generic.findMany({
        where,
        orderBy: { genericName: 'asc' },
        skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
        take: parseInt(limit, 10),
      }),
      prisma.generic.count({ where }),
    ]);

    return {
      generics,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    };
  } catch (error) {
    console.error('Error fetching generics:', error);
    throw new Error('Failed to fetch generics from database');
  }
}

/**
 * Get one generic by id.
 *
 * Intentionally NOT filtered by isDeleted, mirroring
 * `medicines.service.js:getMedicineById`: this route is admin-only and the
 * restore endpoint and edit form both need to resolve a soft-deleted generic.
 *
 * @param {Number} id - Generic id.
 * @returns {Object|null} - The generic, or null if no such id exists.
 */
async function getGenericById(id) {
  try {
    const generic = await prisma.generic.findUnique({ where: { genericId: id } });
    return generic;
  } catch (error) {
    console.error('Error fetching generic:', error);
    throw new Error('Failed to fetch generic');
  }
}

/**
 * Create a generic.
 *
 * `genericId` is omitted on purpose: it is assigned by the sequence added in
 * `prisma/phase3-generics-autoincrement.sql`. Until that file is applied this
 * throws rather than writing a null id.
 *
 * @param {Object} data - Validated request body.
 * @returns {Object} - The created generic.
 */
async function createGeneric(data) {
  try {
    return await prisma.generic.create({ data: buildData(data, null) });
  } catch (error) {
    // `genericName` is @unique, so a collision surfaces here. Prisma tags it
    // P2002. Rethrown as a 409 by the controller rather than a 500 — it is a
    // conflict with the request, not a server fault. The wrinkle worth
    // explaining in the message: a soft-deleted generic still holds its name,
    // because the flag does not free the unique value.
    if (error.code === 'P2002') {
      error.status = 409;
      error.message = 'A generic with that name already exists. If it was deleted, restore it or pick another name.';
    }
    console.error('Error creating generic:', error);
    throw error;
  }
}

/**
 * Update a generic.
 *
 * Partial: only fields present in the body are touched. Renaming is allowed and
 * is a hash change, so already-synced devices see the new name as a diff.
 *
 * @param {Number} id - Generic id.
 * @param {Object} data - Validated request body.
 * @returns {Object|null} - The updated generic, or null if no such id exists.
 */
async function updateGeneric(id, data) {
  try {
    // Read first because the description count has to be computed against the
    // merged row, not just the edited columns. A non-existent id resolves to
    // null here and the controller answers 404 rather than letting Prisma throw
    // P2025 into a 500.
    const existing = await prisma.generic.findUnique({ where: { genericId: id } });
    if (!existing) return null;

    return await prisma.generic.update({
      where: { genericId: id },
      data: buildData(data, existing),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      error.status = 409;
      error.message = 'A generic with that name already exists.';
    }
    console.error('Error updating generic:', error);
    throw error;
  }
}

/**
 * Soft delete a generic (Phase 3).
 *
 * Idempotent: a repeated DELETE reports success instead of throwing P2025, and
 * the `isDeleted: false` guard means a repeat writes nothing at all — a no-op
 * delete must not bump `updated_at`.
 *
 * Medicines pointing at this generic are left untouched on purpose. Their
 * `generic_id` stays valid and the sync stream still sends them, so the
 * deletion reaches devices as a single generic tombstone rather than as a
 * cascade of medicine updates.
 *
 * @param {Number} id - Generic id.
 * @returns {Object|null} - The generic, or null if no such id exists.
 */
async function deleteGeneric(id) {
  try {
    await prisma.generic.updateMany({
      where: { genericId: id, ...NOT_DELETED },
      data: { isDeleted: true },
    });

    // Read back unfiltered so a missing id is distinguishable from an
    // already-soft-deleted one, rather than inferred from the update count.
    // `updateMany` always issues the query, so count is the only signal.
    return await prisma.generic.findUnique({ where: { genericId: id } });
  } catch (error) {
    console.error('Error soft-deleting generic:', error);
    throw new Error('Failed to delete generic');
  }
}

/**
 * Reverse a soft delete (Phase 3).
 *
 * Idempotent in the same direction as delete — restoring a live generic is a
 * no-op that leaves `updated_at` alone. When it does write, the bumped
 * `updated_at` is what resurfaces the generic on already-synced devices.
 *
 * @param {Number} id - Generic id.
 * @returns {Object|null} - The generic, or null if no such id exists.
 */
async function restoreGeneric(id) {
  try {
    await prisma.generic.updateMany({
      where: { genericId: id, isDeleted: true },
      data: { isDeleted: false },
    });

    return await prisma.generic.findUnique({ where: { genericId: id } });
  } catch (error) {
    console.error('Error restoring generic:', error);
    throw new Error('Failed to restore generic');
  }
}

module.exports = {
  getGenerics,
  getGenericById,
  createGeneric,
  updateGeneric,
  deleteGeneric,
  restoreGeneric,
  // Exported for the verification harness; not part of the HTTP surface.
  countDescriptions,
  DESCRIPTION_COLUMNS,
};