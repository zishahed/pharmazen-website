-- ============================================================================
-- PharmaZen Phase 7b — prescription dispensing limits
-- ============================================================================
--
-- WHAT THIS DOES
--   1. `prescriptions.max_quantity` — the number of units of the medicine the
--      pharmacist authorised when approving. The pharmacist decides this.
--   2. `prescriptions.consumed_quantity` — units already dispensed against it.
--   3. `order_items.prescription_id` — which prescription authorised each line.
--
-- WHY
--   The gate in `orders.service.js` asked only "is there an approved, in-date
--   prescription for this user and medicine?". It never asked how much of it had
--   already been used, so one approval authorised unlimited repeat orders for
--   the whole of its date range. That is not theoretical: of the 5 approved
--   prescriptions in production, one authorised 4 orders and another 2.
--
--   Units, not orders, is the unit of account. A prescription is a course of
--   treatment ("1 tab twice daily x 30 days" = 60 tablets) and a patient may
--   legitimately split that across several orders, so counting orders would
--   either block legitimate refills or fail to bound anything. Capping units
--   bounds the order count implicitly, since every order needs at least one.
--
--   `order_items.prescription_id` is needed as well as the counters: without it
--   a cancelled order cannot know which prescription to give its units back to.
--   It also starts closing the audit-trail gap where an order recorded only the
--   last of several authorising prescriptions.
--
-- SAFETY — why the default cannot break anyone
--   All 10 prescriptions currently in production have `end_date < now()`, so
--   none of them can authorise an order today and none is affected by the
--   backfill. The new default only governs approvals made after deploy.
--
--   `consumed_quantity` is backfilled from what was actually dispensed rather
--   than reset to 0, so the pre-existing over-use stays visible in the record.
--   That can leave `consumed_quantity > max_quantity` for historical rows --
--   deliberately. Clamping would erase the fact that those prescriptions were
--   dispensed beyond what anyone authorised. The API clamps `remaining` at 0.
--
--   Nothing is dropped and nothing is locked beyond brief ACCESS SHARE. Every
--   statement is guarded, so re-running is safe.
--
-- HOW TO APPLY
--   Neon console -> Query Editor -> paste -> Run.
--   Or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/phase7-prescription-limits.sql
--
-- ROLLOUT ORDER
--   1. Run this file.
--   2. Deploy Phase 7b code. Before this file the code fails loudly (missing
--      column), which is the safe order -- do not deploy the code first.
--   3. Add the limit input to the pharmacist review screen.
--


-- ----------------------------------------------------------------------------
-- 1. Counters on prescriptions
-- ----------------------------------------------------------------------------
-- DEFAULT 5 matches the existing per-order MAX_QUANTITY in cart/orders services,
-- so a pharmacist who states no limit authorises exactly one cart's worth. It is
-- a floor, not a ceiling: the review endpoint accepts an explicit value and
-- validates it against MAX_AUTHORIZED_QUANTITY.
ALTER TABLE "prescriptions"
    ADD COLUMN IF NOT EXISTS "max_quantity" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "prescriptions"
    ADD COLUMN IF NOT EXISTS "consumed_quantity" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_max_quantity_positive'
    ) THEN
        ALTER TABLE "prescriptions"
            ADD CONSTRAINT "prescriptions_max_quantity_positive"
            CHECK ("max_quantity" > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_consumed_quantity_non_negative'
    ) THEN
        ALTER TABLE "prescriptions"
            ADD CONSTRAINT "prescriptions_consumed_quantity_non_negative"
            CHECK ("consumed_quantity" >= 0);
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 2. Per-line attribution
-- ----------------------------------------------------------------------------
ALTER TABLE "order_items"
    ADD COLUMN IF NOT EXISTS "prescription_id" UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_items_prescription_id_fkey'
    ) THEN
        -- SET NULL rather than RESTRICT: removing a prescription must not delete
        -- order history. A deleted prescription becomes unattributed instead.
        ALTER TABLE "order_items"
            ADD CONSTRAINT "order_items_prescription_id_fkey"
            FOREIGN KEY ("prescription_id")
            REFERENCES "prescriptions"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "order_items_prescription_id_idx"
    ON "order_items" ("prescription_id");


-- ----------------------------------------------------------------------------
-- 3. Backfill
-- ----------------------------------------------------------------------------
-- Attribute historical order lines to the order's prescription, restricted to
-- sensitive medicines. An order may mix restricted and unrestricted lines, and
-- the order-level prescription only ever covered the restricted ones, so
-- attributing every line would overstate what was authorised.
--
-- The join is wrapped in a subquery, and this is not stylistic. Written as a flat
-- `UPDATE "order_items" oi ... FROM "orders" o JOIN "medicines" m ON m.id =
-- oi.medicine_id`, Postgres rejects it:
--
--     ERROR: invalid reference to FROM-clause entry for table "oi"
--     DETAIL: There is an entry for table "oi", but it cannot be referenced from
--             this part of the query.
--
-- An UPDATE's target alias is not in scope inside the FROM list's own JOIN
-- conditions -- only in the WHERE clause. Putting the join in a subquery gives
-- `oi` its own scope, and the outer statement matches on id, which is exactly
-- equivalent and legal. Verified by reproducing the error and the fix on a
-- scratch Postgres 16.
UPDATE "order_items"
SET "prescription_id" = src."prescription_id"
FROM (
    SELECT oi."id"            AS "item_id",
           o."prescription_id" AS "prescription_id"
    FROM "order_items" oi
    JOIN "orders" o    ON o."id" = oi."order_id"
    JOIN "medicines" m ON m."id" = oi."medicine_id"
    WHERE o."prescription_id" IS NOT NULL
      AND m."is_sensitive" = true
) AS src
WHERE "order_items"."id" = src."item_id"
  AND "order_items"."prescription_id" IS NULL;

-- Record what each prescription actually dispensed. LEFT JOIN-free and
-- idempotent: re-running recomputes the same total from the same lines.
UPDATE "prescriptions" p
SET "consumed_quantity" = COALESCE((
    SELECT SUM(oi."quantity")
    FROM "order_items" oi
    WHERE oi."prescription_id" = p."id"
), 0);


-- ============================================================================
-- VERIFY
-- ============================================================================

-- 1. Both counters exist and are NOT NULL.
--
--    Expected: two rows, is_nullable = NO, max_quantity default 5,
--    consumed_quantity default 0.
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'prescriptions'
  AND column_name IN ('max_quantity', 'consumed_quantity')
ORDER BY column_name;

-- 2. The FK exists and is SET NULL.
--
--    Expected: one row, confdeltype = 'n'.
SELECT conname, confdeltype
FROM pg_constraint
WHERE conname = 'order_items_prescription_id_fkey';

-- 3. The backfill attributed lines.
--
--    Expected: attributed = 8 (the restricted lines behind the 8 historical
--    order links), unattributed_sensitive = 0.
SELECT
    (SELECT count(*)::int FROM "order_items" WHERE "prescription_id" IS NOT NULL) AS attributed,
    (SELECT count(*)::int
       FROM "order_items" oi
       JOIN "medicines" m ON m."id" = oi."medicine_id"
      WHERE m."is_sensitive" AND oi."prescription_id" IS NULL) AS unattributed_sensitive;

-- 4. No NULL counters survived.
--
--    Expected: 0.
SELECT count(*) AS null_counters
FROM "prescriptions"
WHERE "max_quantity" IS NULL OR "consumed_quantity" IS NULL;


-- ============================================================================
-- DEPLOY CHECKLIST for Phase 7b
-- ============================================================================
--   [ ] VERIFY 1..4 as above
--   [ ] PUT  /api/prescriptions/:id/review {status:'approved', maxQuantity:30} -> 200, maxQuantity 30
--   [ ] PUT  same with maxQuantity:0 or -5                    -> 400, not a silent 0
--   [ ] PUT  same with maxQuantity:99999                     -> 400, above the ceiling
--   [ ] PUT  same with maxQuantity omitted                    -> 200, falls back to 5
--   [ ] GET  /api/prescriptions/:id                           -> 200, shows max/used/remaining
--   [ ] POST /api/orders twice with the same approved prescription
--          -> first succeeds, second is rejected as exhausted, NOT another order
--   [ ] PUT  /api/orders/:id/cancel on the order that consumed units
--          -> units returned; re-ordering the same quantity now succeeds
--   [ ] Cancelling the same order twice                      -> 400, units returned once
--   [ ] POST /api/orders with no prescription at all         -> unchanged message
--   [ ] The React checkout still shows the prescription warning for restricted
--      medicines (the rejection message must contain the word "prescription",
--      because CheckoutPage.jsx:59 gates the warning on that substring)
--   [ ] An order with 2 restricted medicines consumes BOTH prescriptions