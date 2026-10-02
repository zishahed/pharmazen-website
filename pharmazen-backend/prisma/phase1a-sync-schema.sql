-- ============================================================================
-- PharmaZen Sync — Phase 1A  (Neon schema, additive only)
-- ============================================================================
--
-- WHAT THIS DOES
--   Adds the change signal (`updated_at`, `is_deleted`), the stable remote
--   identity bridge (`generic_id`), and the real catalogue columns the mobile
--   app needs, plus the `generics` table.
--
-- WHAT THIS DOES NOT DO
--   Nothing is soft-deleted and no row is removed or rewritten. Every column
--   added to `medicines` is nullable or carries a DEFAULT, and every query
--   already filters `is_deleted = false` — a filter that is inert while the
--   column is all-false. So the running website should behave identically
--   before and after this runs. That is the whole point of Phase 1A.
--
-- SAFETY
--   * Postgres 11+ adds a column with a DEFAULT without a table rewrite, so
--     the 21,715-row `medicines` table is not copied. Expected runtime: <1s.
--   * No DROP, no DELETE, no UPDATE, no column type change, no index rebuild
--     on an existing index.
--   * The `medicines_generic_id_fkey` FK is validated immediately (it is
--     added after the backfill populates `generic_id`; see step 3).
--     To defer validation instead, replace the last statement with:
--       ALTER TABLE "medicines" ADD CONSTRAINT "medicines_generic_id_fkey"
--         FOREIGN KEY ("generic_id") REFERENCES "generics"("generic_id")
--         ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
--       ALTER TABLE "medicines" VALIDATE CONSTRAINT "medicines_generic_id_fkey";
--
-- HOW TO APPLY
--   Neon console -> Query Editor -> paste the statements below -> Run.
--   Or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/phase1a-sync-schema.sql
--
-- ROLLOUT ORDER (do not reorder)
--   1. Run this file.                       <- you are here
--   2. Deploy the backend (inert filters + Prisma singleton).
--   3. Verify the website is unchanged (checklist at the bottom).
--   4. Run `npm run seed:sync-source` to backfill real columns.
--   5. Phase 1B enables soft delete — a SEPARATE deploy, days later.
--
-- Generated with:
--   npx prisma migrate diff \
--     --from-url "$DATABASE_URL" \
--     --to-schema-datamodel prisma/schema.prisma --script
-- ============================================================================


-- ── 1. Change signal + identity + real columns on `medicines` ──────────────
-- `updated_at` is the `?since=` cursor for /api/sync (Phase 2). It needs the
-- DEFAULT: without it, pre-existing rows would get NULL and could never be
-- observed by a cursor comparison.
-- All existing rows land on the same bootstrap timestamp, which is fine —
-- that is the intended "everything changed at the migration instant" marker.
ALTER TABLE "medicines" ADD COLUMN     "dosage_form" TEXT,
ADD COLUMN     "generic_id" INTEGER,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "package_container" TEXT,
ADD COLUMN     "package_size" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "strength" TEXT,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- ── 2. The `generics` table ───────────────────────────────────────────────
-- Mirrors the app's SQLite `generics` 1:1. `generic_id` is carried over from
-- the local PK rather than regenerated, so the mobile client can upsert by id.
CREATE TABLE "generics" (
    "generic_id" INTEGER NOT NULL,
    "generic_name" TEXT NOT NULL,
    "slug" TEXT,
    "monograph_link" TEXT,
    "drug_class" TEXT,
    "indication" TEXT,
    "indication_description" TEXT,
    "therapeutic_class_description" TEXT,
    "pharmacology_description" TEXT,
    "dosage_description" TEXT,
    "administration_description" TEXT,
    "interaction_description" TEXT,
    "contraindications_description" TEXT,
    "side_effects_description" TEXT,
    "pregnancy_and_lactation_description" TEXT,
    "precautions_description" TEXT,
    "pediatric_usage_description" TEXT,
    "overdose_effects_description" TEXT,
    "duration_of_treatment_description" TEXT,
    "reconstitution_description" TEXT,
    "storage_conditions_description" TEXT,
    "descriptions_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "generics_pkey" PRIMARY KEY ("generic_id")
);

-- Sync cursor lookups. Without these, every /api/sync page is a seq scan on
-- 21,715 rows.
CREATE UNIQUE INDEX "generics_generic_name_key" ON "generics"("generic_name");
CREATE INDEX "generics_drug_class_idx" ON "generics"("drug_class");
CREATE INDEX "generics_indication_idx" ON "generics"("indication");
CREATE INDEX "generics_updated_at_idx" ON "generics"("updated_at");
CREATE INDEX "medicines_generic_id_idx" ON "medicines"("generic_id");
CREATE INDEX "medicines_updated_at_idx" ON "medicines"("updated_at");


-- ── 3. generic_id foreign key ─────────────────────────────────────────────
-- ON DELETE SET NULL, so Phase 3's generics CRUD can never orphan a medicine
-- or block on a RESTRICT. Re-run this file only once; it is not idempotent.
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_generic_id_fkey" FOREIGN KEY ("generic_id") REFERENCES "generics"("generic_id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================================
-- VERIFICATION — run after step 1
-- ============================================================================
-- Expected: 21715, 0, 0, 0, 20   (9 pre-existing + 11 new columns)
SELECT
    (SELECT count(*) FROM "medicines")                                AS medicines,
    (SELECT count(*) FROM "generics")                                 AS generics,
    (SELECT count(*) FROM "medicines" WHERE "is_deleted")             AS soft_deleted,
    (SELECT count(*) FROM "generics" WHERE "generic_id" IS NOT NULL)  AS generics_seeded,
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'medicines')     AS medicine_columns;

-- Expected: 0 rows. A row here means a `generic_id` with no matching generic;
-- the backfill reports these and refuses to guess.
SELECT m.id, m.name, m.generic_id
FROM "medicines" m
LEFT JOIN "generics" g ON g.generic_id = m.generic_id
WHERE m.generic_id IS NOT NULL AND g.generic_id IS NULL
LIMIT 20;


-- ============================================================================
-- STEP 3 CHECKLIST — confirm the live website is unchanged
-- ============================================================================
--   [ ] GET /api/medicines?limit=20            -> total is still 21715
--   [ ] GET /api/medicines/max-price           -> unchanged
--   [ ] GET /api/medicines/filters             -> genericNames/companies unchanged
--   [ ] GET /api/medicines/restricted          -> unchanged
--   [ ] A guest can still browse and search on pharmazen.vercel.app
--   [ ] A logged-in user can add to cart and check out
--
-- Only after every box is ticked may Phase 1B ship.