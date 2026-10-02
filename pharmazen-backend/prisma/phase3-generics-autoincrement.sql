-- ============================================================================
-- PharmaZen Sync — Phase 3  (sequence-backed generics.generic_id)
-- ============================================================================
--
-- WHAT THIS DOES
--   Backs `generics.generic_id` with a Postgres sequence and gives the column a
--   DEFAULT, so Phase 3's `POST /api/generics` can let the database assign the
--   id instead of requiring an admin to hand-pick a unique integer.
--
-- WHY
--   `Generic.genericId` is `Int @id` with no `@default`, and the row ids came
--   from the legacy source SQLite via `seed-sync-source.js`, which supplied them
--   explicitly. Nothing generates them, so admin CRUD would have to ask the
--   admin for an id — a collision-prone integer field that grows forever.
--
--   Note what this does NOT need: generics have no autoincrement already, and
--   `is_deleted` / `updated_at` already exist from Phase 1A. This file is only
--   about the id.
--
-- THE IMPORTANT PART — `setval` IS NOT OPTIONAL
--   `npx prisma migrate diff` generates exactly these three statements and
--   stops there:
--
--       CREATE SEQUENCE generics_generic_id_seq;
--       ALTER TABLE "generics" ALTER COLUMN "generic_id"
--           SET DEFAULT nextval('generics_generic_id_seq');
--       ALTER SEQUENCE generics_generic_id_seq OWNED BY "generics"."generic_id";
--
--   That output is correct for an empty table and wrong for this one. A new
--   sequence starts at 1, and current ids run 3..2072, so without the `setval`
--   below the first two creates get ids 1 and 2 (harmless) and the THIRD gets
--   id 3 — already taken. The failure is a duplicate-key error on the third
--   insert, which reads like a data bug rather than a migration bug. If you
--   ever regenerate this migration with Prisma, add the `setval` back.
--
--   `true` as the third argument sets `is_called = true`, which is what makes the
--   next `nextval` return MAX(generic_id) + 1 = 2073. `false` is the intuitive
--   looking choice and is wrong: it records that 2072 has not been handed out
--   yet, so the next insert is given 2072 and violates the primary key.
--
-- SAFETY
--   * No existing row is read, written or locked beyond the brief ACCESS SHARE
--     that MAX(generic_id) takes; adding a DEFAULT is metadata-only in
--     Postgres 11+ and does not rewrite the table.
--   * Nothing is dropped. Re-running is safe: the sequence/column DDL is
--     idempotent as written, and `setval` is explicitly idempotent too.
--   * Phase 3's code works without this file — a create that omits `generic_id`
--     only needs the DEFAULT. Run it before deploying or the first generic an
--     admin creates fails with a null-id error.
--
-- HOW TO APPLY
--   Neon console -> Query Editor -> paste -> Run.
--   Or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/phase3-generics-autoincrement.sql
--
-- ROLLOUT ORDER
--   1. Phase 1B deployed.                                  <- done (dcef5e7)
--   2. Phase 2 indexes applied and Phase 2 deployed.       <- pending
--   3. Run this file.
--   4. Deploy Phase 3.
--


CREATE SEQUENCE IF NOT EXISTS "generics_generic_id_seq";

ALTER TABLE "generics"
    ALTER COLUMN "generic_id" SET DEFAULT nextval('generics_generic_id_seq');

ALTER SEQUENCE "generics_generic_id_seq" OWNED BY "generics"."generic_id";

-- Seed past every existing id. The one line Prisma omits. Idempotent: re-running
-- re-reads MAX, so it is safe to repeat if a generic was created in between.
--
-- The third argument is the whole subtlety: `true` means "2072 has been handed
-- out", so the next nextval is 2073. Do not "simplify" it to false.
SELECT setval(
    'generics_generic_id_seq',
    GREATEST((SELECT COALESCE(MAX(generic_id), 0) FROM "generics"), 1),
    true
);


-- ============================================================================
-- VERIFY
-- ============================================================================
-- 1. The column has a DEFAULT.
--
--    Expected: generic_id_next = 'generics_generic_id_seq', and is_nullable = NO.
--    If generic_id_next is NULL the ALTER did not apply.
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'generics' AND column_name = 'generic_id';

-- 2. The sequence is seeded past the data and owned by the column.
--
--    Expected: last_value = 2072 (or higher if generics were created since),
--    and owned_by = public.generics_generic_id_seq. Ownership matters: without
--    OWNED BY, DROP TABLE generics would leave the sequence behind.
--
--    The ownership check is pg_get_serial_sequence, not pg_sequences. There is
--    no `is_owned_by` column on pg_sequences -- it exposes schemaname,
--    sequencename, sequenceowner, data_type, start_value, min_value,
--    max_value, increment_by, cycle, cache_size and last_value, and nothing
--    else, so selecting `is_owned_by` from it errors out with
--    `column "is_owned_by" does not exist`. pg_get_serial_sequence returns the
--    owning sequence's qualified name, or NULL when the column has none, which
--    is exactly the distinction being asserted.
SELECT
    (SELECT last_value FROM generics_generic_id_seq) AS last_value,
    (SELECT MAX(generic_id) FROM generics)           AS max_id,
    pg_get_serial_sequence('generics', 'generic_id') AS owned_by;

-- 3. The next id cannot collide.
--
--    Expected: 2073 (or higher). It must be strictly greater than max_id above.
--
--    Note this CONSUMES the value it prints: nextval hands it out and advances
--    the sequence. Running this file therefore leaves the first real admin create
--    on max_id + 2, not max_id + 1. That is harmless -- it is an arbitrary
--    integer key -- but do not read 2073 here as "the id my create will get".
SELECT nextval('generics_generic_id_seq') AS next_id;


-- ============================================================================
-- DEPLOY CHECKLIST for Phase 3
-- ============================================================================
--   [ ] VERIFY 1 shows a non-null column_default
--   [ ] VERIFY 2 shows last_value >= max_id and owned_by = public.generics_generic_id_seq
--   [ ] VERIFY 3 shows next_id > max_id
--   [ ] GET  /api/generics                     -> 200, list excludes soft-deleted
--   [ ] GET  /api/generics?includeDeleted=true -> 200, includes them
--   [ ] POST /api/generics {genericName}       -> 201, id assigned by the sequence
--   [ ] POST /api/generics with a taken name   -> 409, not 500
--   [ ] POST /api/generics twice               -> ids strictly increasing
--   [ ] PUT  /api/generics/:id                 -> 200, descriptions_count recomputed
--   [ ] DELETE /api/generics/:id twice         -> both succeed, second is a no-op
--   [ ] POST /api/admin/generics/:id/restore   -> 200, isDeleted false
--   [ ] GET /api/generics                      -> the soft-deleted row is gone again
--   [ ] A device syncs and receives the generic with isDeleted: true