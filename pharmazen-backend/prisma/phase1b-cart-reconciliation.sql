-- ============================================================================
-- PharmaZen Sync — Phase 1B  (reconcile carts against soft-deleted medicines)
-- ============================================================================
--
-- WHY THIS EXISTS
--   `CartItem.medicine` declares no `onDelete`, so while DELETE was a hard
--   delete Postgres enforced RESTRICT and `deleteMedicine` *failed* for any
--   medicine sitting in a cart. Phase 1B replaces that with an `is_deleted`
--   flag, which removes the FK obstacle: the delete now succeeds and the row
--   stays put.
--
--   So a cart can now hold a reference to a soft-deleted medicine. Nothing
--   breaks — `getCart` and `createOrderFromCart` both filter those rows out,
--   so nothing is ever sold and checkout cannot disagree with the cart — but
--   dead `cart_items` accumulate. They are invisible to every read path, and
--   they spring back to life the moment the medicine is restored, which is
--   confusing enough to be worth cleaning up.
--
--   This file reports them (STEP 1) and removes them (STEP 2).
--
-- WHAT IT DELIBERATELY DOES NOT TOUCH
--   `order_items`. An order records what was actually sold at a given price and
--   `OrderItem.priceAtPurchase` is the historical truth, so a soft-deleted
--   medicine in order history is expected, correct, and must survive. STEP 0
--   reports that count for visibility and nothing more. This is why soft delete
--   was chosen over a real delete in the first place.
--
-- SAFETY
--   * STEP 2 is the only statement that mutates, and it deletes from
--     `cart_items` only — never from `medicines` or `order_items`.
--   * Its predicate requires the medicine to already be soft-deleted, so it can
--     never remove a row for a live medicine.
--   * Wrapped in a transaction, so a partial delete is not possible.
--   * `cart_items` is referenced by nothing else and cascades from `carts`, so
--     every removed row is trivially reconstructible: the customer re-adds the
--     medicine. Nothing of record is lost.
--   * Every step is idempotent; re-running the whole file is safe.
--
-- HOW TO APPLY
--   Neon console -> Query Editor -> paste -> Run.
--   Or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/phase1b-cart-reconciliation.sql
--
--   Run the file top to bottom and read the STEP 1 output before STEP 2 — the
--   count it prints is the number of rows STEP 2 will delete.
--
-- ROLLOUT ORDER (do not reorder)
--   1. Phase 1A deployed and verified (commit a5ca612).          <- done
--   2. Deploy Phase 1B (soft delete + restore endpoint).         <- you are here
--   3. Run this file.
--   4. Run the STEP 4 checklist.
--


-- ============================================================================
-- STEP 0 — baseline
-- ============================================================================
-- Expected right after the Phase 1B deploy: soft_deleted_medicines is 0, because
-- nothing has been soft-deleted yet. That is what makes this file safe to run
-- first: there is provably nothing to reconcile. The interesting number is
-- soft_deleted_in_order_history, which is allowed to be non-zero and grows from
-- here on.
SELECT
    (SELECT count(*) FROM "medicines")                                    AS total_medicines,
    (SELECT count(*) FROM "medicines" WHERE "is_deleted")                AS soft_deleted_medicines,
    (SELECT count(*) FROM "cart_items")                                   AS total_cart_items,
    (SELECT count(*) FROM "order_items" oi
       JOIN "medicines" m ON m.id = oi.medicine_id
      WHERE m."is_deleted")                                               AS soft_deleted_in_order_history;


-- ============================================================================
-- STEP 1 — carts holding a soft-deleted medicine
-- ============================================================================
-- Expected: 0 rows on a fresh Phase 1B deploy. Non-zero only if medicines were
-- soft-deleted between the deploy and this run, which is the case this file
-- exists for. Note the count of rows is exactly what STEP 2 removes.
SELECT
    ci.id                     AS cart_item_id,
    c.user_id,
    u.email                   AS customer_email,
    m.id                      AS medicine_id,
    m.name                    AS medicine_name,
    ci.quantity,
    m.updated_at              AS deleted_at
FROM "cart_items" ci
JOIN "carts" c     ON c.id = ci.cart_id
JOIN "users" u     ON u.id = c.user_id
JOIN "medicines" m ON m.id = ci.medicine_id
WHERE m."is_deleted"
ORDER BY u.email, m.name;

-- Per-customer rollup, so anyone who needs to be told their cart shrank can be.
SELECT
    u.email                                       AS customer_email,
    count(*)                                      AS affected_items,
    sum(ci.quantity)                              AS affected_units,
    string_agg(m.name, ', ' ORDER BY m.name)      AS medicines
FROM "cart_items" ci
JOIN "carts" c     ON c.id = ci.cart_id
JOIN "users" u     ON u.id = c.user_id
JOIN "medicines" m ON m.id = ci.medicine_id
WHERE m."is_deleted"
GROUP BY u.email
ORDER BY affected_items DESC;


-- ============================================================================
-- STEP 2 — remove them
-- ============================================================================
BEGIN;

DELETE FROM "cart_items" ci
USING "medicines" m
WHERE m.id = ci.medicine_id
  AND m."is_deleted";

COMMIT;
-- Expected after the COMMIT: DELETE n, where n is the STEP 1 row count.


-- ============================================================================
-- STEP 3 — verify
-- ============================================================================
-- Expected: remaining_stale_cart_items is 0, and total_cart_items has dropped by
-- exactly the n from STEP 2. If it dropped by more, investigate before
-- continuing; nothing in this file deletes anything else.
SELECT
    (SELECT count(*) FROM "cart_items" ci
       JOIN "medicines" m ON m.id = ci.medicine_id
      WHERE m."is_deleted")                          AS remaining_stale_cart_items,
    (SELECT count(*) FROM "cart_items")              AS total_cart_items,
    (SELECT count(*) FROM "order_items")             AS total_order_items,
    (SELECT count(*) FROM "medicines")               AS total_medicines;


-- ============================================================================
-- STEP 4 — checklist for the soft-delete deploy
-- ============================================================================
--   [ ] STEP 3 shows remaining_stale_cart_items = 0
--   [ ] total_order_items is unchanged from STEP 0 — history survived
--   [ ] total_medicines is unchanged from STEP 0 — nothing was hard-deleted
--   [ ] GET  /api/medicines?limit=20          -> total drops by 1 after deleting
--   [ ] GET  /api/admin/stats                 -> totalMedicines agrees with the above
--   [ ] DELETE a medicine, then GET it as admin -> still resolves, is_deleted = true
--   [ ] POST  /api/admin/medicines/:id/restore  -> total returns to its old value
--   [ ] DELETE twice                          -> 200 both times, not a 500
--   [ ] DELETE a nonexistent UUID             -> 404, not a 500
--   [ ] Add a soft-deleted medicine to a cart -> 404 'Medicine is no longer available'
--   [ ] A guest can still browse and search on pharmazen.vercel.app
--
-- Only after every box is ticked is Phase 1B done.