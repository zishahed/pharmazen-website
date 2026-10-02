/**
 * Wire DTOs for `GET /api/sync` and `GET /api/sync/manifest`.
 *
 * These are explicit projections rather than a Prisma pass-through, for three
 * reasons:
 *
 *  1. **The DTO is what gets hashed.** content_hash.js hashes exactly the object
 *     built here, so the manifest hash and the delta hash can never disagree
 *     about a row. Hashing the Prisma row instead would need a second mapping,
 *     and a mapping is exactly where that kind of bug lives.
 *  2. **Nothing the app does not need is sent.** `price`, `stockQuantity`,
 *     `expiryDate`, `requiresPrescription`, `description` and `createdAt` are
 *     all absent from the local `medicines` schema this sync writes into. Price
 *     in particular is deliberately not synced (SYNC.md), and `description` is
 *     kept on the server only for the website's search filters.
 *  3. **`brandName`, not `name`.** The client's SyncMedicine reads
 *     `brandName ?? name`; sending the explicit name keeps the intent visible
 *     here rather than leaning on that fallback.
 */

const { GENERIC_DESCRIPTION_COLUMNS } = require('./content_hash');

/**
 * Columns selected for a medicine page. `generic` is joined in so the
 * denormalised `genericName` travels with the row.
 *
 * `updatedAt` is not for the client — it is the keyset column the cursor
 * resumes from, and it is sent only so a mismatched page is diagnosable from a
 * packet capture.
 */
const MEDICINE_SELECT = {
  id: true,
  name: true,
  genericId: true,
  slug: true,
  type: true,
  dosageForm: true,
  strength: true,
  manufacturer: true,
  packageContainer: true,
  packageSize: true,
  isSensitive: true,
  isDeleted: true,
  updatedAt: true,
  generic: { select: { genericName: true } },
};

const GENERIC_SELECT = {
  genericId: true,
  genericName: true,
  slug: true,
  monographLink: true,
  drugClass: true,
  indication: true,
  descriptionsCount: true,
  isDeleted: true,
  updatedAt: true,
};
for (const column of GENERIC_DESCRIPTION_COLUMNS) {
  GENERIC_SELECT[`${column}Description`] = true;
}

/** Postgres timestamptz -> ISO-8601 with milliseconds and a Z, which is what
 *  `Date.prototype.toISOString` produces and what the client compares
 *  lexicographically. Fixed width matters: `_newer` in sync_engine.dart relies
 *  on string ordering. */
function iso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}

/**
 * @param {Object} row - A row matching MEDICINE_SELECT.
 * @returns {Object} The wire shape for one medicine.
 */
function toMedicineDto(row) {
  return {
    id: row.id,
    brandName: row.name,
    // Denormalised for the client. Null when genericId is null, and also null
    // when the FK points at a generic that does not exist — the client's
    // GenericResolver falls back to resolving by name, then to a stub.
    genericName: row.generic ? row.generic.genericName : null,
    genericId: row.genericId ?? null,
    slug: row.slug ?? null,
    type: row.type ?? null,
    dosageForm: row.dosageForm ?? null,
    strength: row.strength ?? null,
    manufacturer: row.manufacturer ?? null,
    packageContainer: row.packageContainer ?? null,
    packageSize: row.packageSize ?? null,
    isSensitive: row.isSensitive ?? false,
    isDeleted: row.isDeleted ?? false,
    updatedAt: iso(row.updatedAt),
  };
}

/**
 * The fifteen monograph fields are emitted as `${column}Description`, which is
 * the first key the client tries (`json['${column}Description'] ?? json[column]`).
 *
 * @param {Object} row - A row matching GENERIC_SELECT.
 * @returns {Object} The wire shape for one generic.
 */
function toGenericDto(row) {
  const dto = {
    genericId: row.genericId,
    genericName: row.genericName,
    slug: row.slug ?? null,
    monographLink: row.monographLink ?? null,
    drugClass: row.drugClass ?? null,
    indication: row.indication ?? null,
    descriptionsCount: row.descriptionsCount ?? 0,
    isDeleted: row.isDeleted ?? false,
    updatedAt: iso(row.updatedAt),
  };
  for (const column of GENERIC_DESCRIPTION_COLUMNS) {
    dto[`${column}Description`] = row[`${column}Description`] ?? null;
  }
  return dto;
}

module.exports = {
  MEDICINE_SELECT,
  GENERIC_SELECT,
  toMedicineDto,
  toGenericDto,
  iso,
};