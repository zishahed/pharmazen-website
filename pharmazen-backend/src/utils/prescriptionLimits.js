/**
 * Phase 7b — prescription dispensing limits.
 *
 * An approved prescription used to be a boolean: present, in-date, and therefore
 * good for unlimited repeat orders. It is now a budget. The pharmacist states
 * `maxQuantity` when approving, `consumedQuantity` accumulates as orders dispense
 * against it, and `remainingQuantity` is what is left.
 *
 * Everything that mutates a budget goes through `reserveUnits` / `releaseUnits`
 * rather than a read-modify-write. Reading `consumedQuantity` and then writing
 * `consumedQuantity + n` would let two simultaneous checkouts both pass the
 * check and together overshoot the limit. Both helpers instead issue a single
 * conditional UPDATE and report how many rows it actually claimed, so the
 * database — not the Node event loop — is the thing enforcing the cap.
 */

/**
 * Units authorised when a pharmacist approves without stating a figure.
 *
 * Deliberately equal to the existing per-order MAX_QUANTITY in the cart and
 * order services, so the default means "one cart's worth" rather than an
 * arbitrary number. Stated explicitly as a limit in the review UI.
 */
const DEFAULT_AUTHORIZED_QUANTITY = 5;

/**
 * Ceiling on what a pharmacist may authorise.
 *
 * Not a business rule -- it exists so a typo (an extra zero, a pasted order id)
 * cannot authorise a million tablets. Adjust if the pharmacy needs it.
 */
const MAX_AUTHORIZED_QUANTITY = 1000;

/**
 * Remaining units on a prescription, floored at 0.
 *
 * Historical rows can carry `consumedQuantity > maxQuantity` because the
 * backfill records real pre-existing over-use rather than hiding it. A negative
 * remaining would read as "owes the pharmacy stock", so it clamps instead.
 *
 * @param {Object} prescription - needs maxQuantity and consumedQuantity
 * @returns {Number}
 */
function remainingUnits(prescription) {
  const max = prescription?.maxQuantity ?? DEFAULT_AUTHORIZED_QUANTITY;
  const used = prescription?.consumedQuantity ?? 0;
  return Math.max(0, max - used);
}

/**
 * Atomically claim `quantity` units, refusing to overshoot.
 *
 * The guard lives in the WHERE clause, so the check and the write are one
 * statement. Two concurrent callers cannot both succeed: the second UPDATE's
 * predicate is re-evaluated against the row the first one committed, finds no
 * remaining capacity, and claims 0 rows.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {String} prescriptionId
 * @param {Number} quantity
 * @returns {Promise<Boolean>} true if the units were claimed
 */
async function reserveUnits(tx, prescriptionId, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Cannot reserve a non-positive quantity of units');
  }

  const claimed = await tx.$executeRaw`
    UPDATE "prescriptions"
       SET "consumed_quantity" = "consumed_quantity" + ${quantity}
     WHERE "id" = CAST(${prescriptionId} AS uuid)
       AND "consumed_quantity" + ${quantity} <= "max_quantity"
  `;

  return claimed === 1;
}

/**
 * Atomically hand `quantity` units back, never below zero.
 *
 * Used when an order is cancelled. The `consumed_quantity > 0` predicate is belt
 * and braces: `cancelOrder` already refuses to cancel a cancelled order, so a
 * double release should be unreachable, and this keeps it from going negative if
 * that guard is ever bypassed.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {String} prescriptionId
 * @param {Number} quantity
 * @returns {Promise<Boolean>} true if anything was released
 */
async function releaseUnits(tx, prescriptionId, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return false;
  }

  const released = await tx.$executeRaw`
    UPDATE "prescriptions"
       SET "consumed_quantity" = GREATEST("consumed_quantity" - ${quantity}, 0)
     WHERE "id" = CAST(${prescriptionId} AS uuid)
       AND "consumed_quantity" > 0
  `;

  return released === 1;
}

/**
 * Find which of a prescription's candidates can cover `quantity` units.
 *
 * Only a filter for *selection*; `reserveUnits` remains the enforcement point.
 * Candidates arrive newest-first, so a patient with two live approvals spends
 * the most recent one and leaves the older one intact for a later refill.
 *
 * @param {Array<Object>} candidates - ordered by createdAt desc
 * @param {Number} quantity
 * @returns {Object|null}
 */
function firstPrescriptionWithCapacity(candidates, quantity) {
  return candidates.find((rx) => remainingUnits(rx) >= quantity) || null;
}

/**
 * Validate and normalise a pharmacist-supplied limit.
 *
 * @param {*} value - raw request value
 * @returns {Number} the limit to apply
 * @throws {Error} with .status = 400 when out of range
 */
function parseAuthorizedQuantity(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_AUTHORIZED_QUANTITY;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed)) {
    const error = new Error('Authorised quantity must be a whole number.');
    error.status = 400;
    throw error;
  }

  if (parsed < 1 || parsed > MAX_AUTHORIZED_QUANTITY) {
    const error = new Error(
      `Authorised quantity must be between 1 and ${MAX_AUTHORIZED_QUANTITY}.`
    );
    error.status = 400;
    throw error;
  }

  return parsed;
}

module.exports = {
  DEFAULT_AUTHORIZED_QUANTITY,
  MAX_AUTHORIZED_QUANTITY,
  remainingUnits,
  reserveUnits,
  releaseUnits,
  firstPrescriptionWithCapacity,
  parseAuthorizedQuantity,
};