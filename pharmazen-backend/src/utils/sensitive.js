/**
 * Phase 7 step 1 — single source of truth for the "restricted medicine" flag.
 *
 * `medicines` carried two columns for the same concept. `requires_prescription`
 * was the original: it gated the cart, the order and the React frontend.
 * `is_sensitive` arrived in Phase 1A as a sync column and has since become the
 * authoritative one:
 *
 *   - `sync/wire.js` MEDICINE_SELECT ships `isSensitive`, not the legacy field,
 *     so the mobile app only ever receives this one.
 *   - `sync/content_hash.js` hashes `isSensitive`, not the legacy field.
 *   - The app has no reference to the legacy column at all.
 *
 * The two are identical across all 21,715 live medicines (91 restricted), so
 * switching the gate changes no behaviour and — because no content hash moves —
 * no device resyncs.
 *
 * The catch is that the *write* path still targets the legacy column. Moving the
 * gate to `isSensitive` while leaving the admin CRUD writing
 * `requires_prescription` would let the two drift apart the first time an admin
 * ticks the checkbox: the edit would "succeed" and the gate would ignore it.
 * So every write goes through `sensitiveWriteFields` below, which sets both
 * columns together. `requires_prescription` is retained as a mirror until the
 * column is actually dropped in a later step, after the React frontend has been
 * verified against the deployed site.
 */

/** The authoritative column. Reads and the prescription gate use this one. */
const SENSITIVE_FIELD = 'isSensitive';

/** Retained mirror, kept in lockstep by `sensitiveWriteFields` only. */
const LEGACY_SENSITIVE_FIELD = 'requiresPrescription';

/**
 * Coerce a client-supplied sensitivity flag to a strict boolean.
 *
 * HTML checkboxes and query strings both arrive as strings, so `'false'` would
 * otherwise be truthy and silently mark a medicine restricted.
 *
 * @param {*} value
 * @returns {Boolean|undefined} undefined when absent, so callers can tell
 *   "not supplied" from "supplied as false" and leave the row untouched.
 */
function coerceSensitive(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return Boolean(value);
}

/**
 * Resolve the intended sensitivity flag from a request body.
 *
 * `isSensitive` wins when both are present; the legacy field is only consulted
 * as a fallback, which is what keeps the current React admin UI — which still
 * posts `requiresPrescription` — working untouched during the transition.
 *
 * @param {Object} data
 * @returns {Boolean|undefined}
 */
function resolveSensitive(data = {}) {
  const modern = coerceSensitive(data[SENSITIVE_FIELD]);
  if (modern !== undefined) return modern;
  return coerceSensitive(data[LEGACY_SENSITIVE_FIELD]);
}

/**
 * Build the Prisma `data` fragment that writes both columns together.
 *
 * Returns `{}` when the caller supplied neither field, so it composes into a
 * spread without clobbering anything on a partial update.
 *
 * @param {Object} data
 * @returns {Object} Prisma data fragment
 */
function sensitiveWriteFields(data = {}) {
  const sensitive = resolveSensitive(data);
  if (sensitive === undefined) return {};
  return { [SENSITIVE_FIELD]: sensitive, [LEGACY_SENSITIVE_FIELD]: sensitive };
}

/**
 * Present the flag to API consumers under both names.
 *
 * `isSensitive` is the value clients should read; `requiresPrescription` stays
 * in the payload until the React frontend moves over and the column is dropped,
 * so this phase cannot remove a field anything currently destructures.
 *
 * @param {Boolean} isSensitive
 * @returns {Object}
 */
function toSensitiveDto(isSensitive) {
  return {
    [SENSITIVE_FIELD]: Boolean(isSensitive),
    [LEGACY_SENSITIVE_FIELD]: Boolean(isSensitive),
  };
}

module.exports = {
  SENSITIVE_FIELD,
  LEGACY_SENSITIVE_FIELD,
  coerceSensitive,
  resolveSensitive,
  sensitiveWriteFields,
  toSensitiveDto,
};