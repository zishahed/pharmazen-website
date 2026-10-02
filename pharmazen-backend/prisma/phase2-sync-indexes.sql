-- ============================================================================
-- PharmaZen Sync — Phase 2  (composite indexes for /api/sync keyset paging)
-- ============================================================================
--
-- WHAT THIS DOES
--   Adds `(updated_at, id)` on `medicines` and `(updated_at, generic_id)` on
--   `generics`. Both are additive and neither touches an existing index.
--
-- WHY
--   `/api/sync` pages a delta by keyset: order by `(updated_at, id)` and resume
--   from the previous page's last row. Postgres serves that optimally from a
--   composite index in exactly that column order — it walks the index forward
--   from the resume position and stops after `SYNC_PAGE_SIZE` rows, so a page
--   costs one page of work instead of re-scanning and re-sorting the whole
--   window.
--
--   The existing `medicines_updated_at_idx` is on `updated_at` alone. That
--   orders the rows but leaves the tiebreak to a sort, so every page would
--   re-visit the rows before its resume position. Over a full resync that is
--   O(window x pages) instead of O(page): ~21,715 rows across ~44 pages. The
--   single-column index stays — it still serves `where updated_at between ...`
--   without the id, and Postgres needs the sort either way for ties.
--
-- SAFETY
--   * CREATE INDEX (not UNIQUE) on Postgres 11+ is built without holding a
--     lock that blocks reads or writes. Expect a few seconds for 21,715 rows.
--   * No existing index is dropped or rebuilt, and no row is touched.
--   * Safe to run before or after the Phase 2 deploy. Without these indexes
--     the endpoint still returns correct results, just slower.
--
-- HOW TO APPLY
--   Neon console -> Query Editor -> paste -> Run.
--   Or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/phase2-sync-indexes.sql
--
-- ROLLOUT ORDER
--   1. Phase 1B deployed.                                  <- done (dcef5e7)
--   2. Run this file.
--   3. Deploy Phase 2.
--


CREATE INDEX IF NOT EXISTS "medicines_updated_at_id_idx"
    ON "medicines" ("updated_at", "id");

CREATE INDEX IF NOT EXISTS "generics_updated_at_generic_id_idx"
    ON "generics" ("updated_at", "generic_id");


-- ============================================================================
-- VERIFY
-- ============================================================================
-- Expected: 2 rows.
--
-- The EXPLAIN is the part that matters. Look for the keyset to be served by
-- Index Scan using medicines_updated_at_id_idx, with a small number of rows
-- removed by the filter and no Sort node. A Sort, or a large
-- "Rows Removed by Filter", means the index was not picked up.
--
-- Bind the literals as real values when running EXPLAIN by hand; the filter
-- here is only there to show the shape.
--
-- Expected for a mid-resync page: actual rows ~500, and rows removed by the
-- keyset filter small (just the ties on the boundary timestamp).
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, generic_id, updated_at
FROM "medicines"
WHERE updated_at > '2026-01-01T00:00:00Z'
  AND updated_at <= '2026-06-01T00:00:00Z'
  AND (updated_at > '2026-03-01T00:00:00Z' OR (updated_at = '2026-03-01T00:00:00Z' AND id > '00000000-0000-0000-0000-000000000000'))
ORDER BY updated_at, id
LIMIT 500;

-- Expected: 2 rows again, same shape.
EXPLAIN (ANALYZE, BUFFERS)
SELECT generic_id, generic_name, updated_at
FROM "generics"
WHERE updated_at > '2026-01-01T00:00:00Z'
  AND updated_at <= '2026-06-01T00:00:00Z'
  AND (updated_at > '2026-03-01T00:00:00Z' OR (updated_at = '2026-03-01T00:00:00Z' AND generic_id > 0))
ORDER BY updated_at, generic_id
LIMIT 500;


-- ============================================================================
-- DEPLOY CHECKLIST for Phase 2
-- ============================================================================
--   [ ] GET  /api/sync                        -> 200, generics page, nextCursor set
--   [ ] GET  /api/sync                        -> ...follow nextCursor to a null, and
--                                                 serverTime is identical on every page
--   [ ] GET  /api/sync?since=<that serverTime> -> the second call is empty
--   [ ] GET  /api/sync?since=<2000-01-01>     -> isFullResync true
--   [ ] GET  /api/sync?cursor=not-base64      -> still 200, treated as page 1
--   [ ] GET  /api/sync/manifest               -> JSON array of [id, hash] pairs
--   [ ] GET  /api/sync/manifest (If-None-Match) -> 304, empty body
--   [ ] 45 rapid GETs                        -> 429 with Retry-After past the limit
--   [ ] A device syncs and `last_success_at` in its sync_state equals serverTime