/**
 * FNV-1a 64-bit content hashing, ported verbatim from the Dart client.
 *
 * The Dart original is `contentHashOfFields` in
 * `lib/data/remote/sync_manifest.dart`. That file states the contract
 * explicitly: "Phase 2 must port this verbatim, including the separator and
 * the field order below, or manifest comparison will flag every row as
 * drifted."
 *
 * Two consequences shape this file:
 *
 *  1. The field order is part of the wire contract. Reordering these lists is a
 *     breaking change that makes every one of the ~21.7k rows look edited.
 *  2. The hash is computed over the **DTO that gets serialised**, not over the
 *     Prisma row. Prisma returns `Decimal` for `price`, `Date` objects for
 *     timestamps and snake-free camelCase keys; hashing the row directly would
 *     mean a second mapping that could drift from the first. See wire.js — the
 *     same object is hashed and sent.
 *
 * 64 bits keeps the collision probability across ~21.7k medicines negligible.
 * 32 bits would already give roughly a 5% chance of one collision.
 */

const MASK_64 = (1n << 64n) - 1n;
const OFFSET_BASIS = 14695981039346656037n;
const PRIME = 1099511628211n;

/** U+001F, the field separator. Matches Dart's `_unitSeparator`. */
const UNIT_SEPARATOR = 0x1f;

/**
 * The 15 monograph columns, in the order `SyncGeneric.descriptionColumns`
 * declares them. Mirrors the local `generics` table's column names with the
 * `_description` suffix stripped.
 *
 * The wire key for each is `${column}Description`, which is what the Dart client
 * reads first (`json['${column}Description'] ?? json[column]`).
 */
const GENERIC_DESCRIPTION_COLUMNS = [
  'indication',
  'therapeuticClass',
  'pharmacology',
  'dosage',
  'administration',
  'interaction',
  'contraindications',
  'sideEffects',
  'pregnancyAndLactation',
  'precautions',
  'pediatricUsage',
  'overdoseEffects',
  'durationOfTreatment',
  'reconstitution',
  'storageConditions',
];

/**
 * Hashes UTF-8 bytes with a trailing U+001F after every field, null rendered as
 * the empty string.
 *
 * Rendering null as '' rather than a distinct token is deliberate: the Dart
 * tests assert that a null field and an empty-string field must hash
 * identically, or every row containing one would rewrite itself on every sync.
 *
 * @param {Array<string|null>} fields
 * @returns {string} 16 lowercase hex digits
 */
function contentHashOfFields(fields) {
  let hash = OFFSET_BASIS;
  for (const field of fields) {
    // Buffer.from encodes exactly what Dart's utf8.encode does, including for
    // non-ASCII, which matters: monograph text is not ASCII-only.
    for (const byte of Buffer.from(field ?? '', 'utf8')) {
      hash = ((hash ^ BigInt(byte)) * PRIME) & MASK_64;
    }
    hash = ((hash ^ BigInt(UNIT_SEPARATOR)) * PRIME) & MASK_64;
  }
  // Dart's `hash.toRadixString(16)`; BigInt uses toString(radix) in JS.
  return hash.toString(16).padStart(16, '0');
}

/**
 * Mirrors `computeMedicineHash`.
 *
 * `genericId` is stringified and null becomes ''. The explicit String() is not
 * optional: Dart's `${m.genericId ?? ''}` coerces an int to a string, whereas
 * passing the number straight through to Buffer.from() throws. `genericId = 0`
 * is a real id, so this must not be a truthiness check.
 */
function computeMedicineHash(dto) {
  return contentHashOfFields([
    dto.brandName,
    dto.genericName,
    dto.genericId == null ? '' : String(dto.genericId),
    dto.type,
    dto.slug,
    dto.dosageForm,
    dto.strength,
    dto.manufacturer,
    dto.packageContainer,
    dto.packageSize,
    dto.isSensitive ? '1' : '0',
    dto.isDeleted ? '1' : '0',
  ]);
}

/**
 * Mirrors `computeGenericHash`: five identity fields, then the fifteen
 * monograph fields in `GENERIC_DESCRIPTION_COLUMNS` order.
 */
function computeGenericHash(dto) {
  return contentHashOfFields([
    dto.genericName,
    dto.slug,
    dto.monographLink,
    dto.drugClass,
    dto.indication,
    ...GENERIC_DESCRIPTION_COLUMNS.map((column) => dto[`${column}Description`]),
    String(dto.descriptionsCount ?? 0),
    dto.isDeleted ? '1' : '0',
  ]);
}

module.exports = {
  GENERIC_DESCRIPTION_COLUMNS,
  contentHashOfFields,
  computeMedicineHash,
  computeGenericHash,
};