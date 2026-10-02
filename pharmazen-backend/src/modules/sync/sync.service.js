const crypto = require('crypto');
const prisma = require('../../utils/prisma');
const { computeMedicineHash } = require('./content_hash');
const {
  STAGE_GENERICS,
  STAGE_MEDICINES,
  newCursor,
  encode,
} = require('./cursor');
const { MEDICINE_SELECT, GENERIC_SELECT, toMedicineDto, toGenericDto, iso } = require('./wire');

/**
 * Read `/api/sync` — the one-way pull that keeps a device's bundled SQLite copy
 * of the catalogue in step with Neon.
 *
 * The protocol is a `?since=` delta, paged with an opaque cursor, and the whole
 * design turns on one idea: **the client must never advance its cursor past a
 * change it has not seen.** Everything below — pinning the snapshot inside the
 * cursor, lagging the snapshot behind the database clock, ordering the keyset —
 * exists to make that guarantee hold.
 */

/**
 * Rows per page.
 *
 * `vercel.json` declares no `maxDuration`, so the serverless budget is the
 * default and a page must not approach it. 500 keeps a medicines page well
 * under a second even on a cold connection; at 21,715 rows a full resync is
 * ~44 requests, which is why the rate limit below is sized for it.
 */
const PAGE_SIZE = intFromEnv('SYNC_PAGE_SIZE', 500, { min: 1, max: 2000 });

/**
 * How far behind the database clock the snapshot is taken.
 *
 * This absorbs a race that would otherwise lose rows permanently. A row's
 * `updated_at` is the start time of the transaction that wrote it, not its
 * commit time. So a transaction that started at T_r but commits after our
 * snapshot query has run is invisible to us *and* has `updated_at` older than
 * the snapshot we are about to hand the client. Next run asks for changes after
 * that snapshot, so the row is skipped forever.
 *
 * Lagging the snapshot by more than the longest write transaction closes it: an
 * in-flight row always has `updated_at` greater than `snapshot - LAG`, so it
 * falls after the client's next `since` and is picked up next time.
 *
 * 5s covers every write path that exists (admin CRUD, stock decrement on
 * payment) with a wide margin. The one exception is the Phase 1 backfill
 * (`npm run seed:sync-source`), which took ~30 minutes: if it is ever re-run,
 * raise this or force a resync afterwards, or devices will miss whatever it
 * wrote.
 */
const SNAPSHOT_LAG_SECONDS = intFromEnv('SYNC_SNAPSHOT_LAG_SECONDS', 5, { min: 0, max: 3600 });

/**
 * How far back a `since` may be before the server stops treating the request as
 * a delta and sends complete state instead (`isFullResync: true`).
 *
 * Nothing is ever hard-deleted, so no change is genuinely unrecoverable; this
 * is a cost bound, not a correctness one. Past it, a delta would page over the
 * entire table anyway, so the honest response is to admit that and let the
 * client rebuild.
 *
 * Note a `since` of null — a first sync — is *not* reported as a full resync.
 * The payload is already complete state in that case, and the client responds
 * by calling `SyncApplier.resetForFullResync()`, which runs
 * `DELETE FROM sync_state`. Triggering that on every fresh install would wipe
 * `bundled_schema_version` for no benefit. SYNC.md defines the flag purely as
 * "the supplied `since` predates retention", so this also matches the spec.
 */
const RETENTION_DAYS = intFromEnv('SYNC_RETENTION_DAYS', 30, { min: 1, max: 3650 });

/** Manifest responses are ~1MB, so hashing 21.7k rows per request is not free.
 *  The manifest exists for repair, where a minute of staleness is irrelevant. */
const MANIFEST_TTL_MS = intFromEnv('SYNC_MANIFEST_TTL_MS', 60_000, { min: 0, max: 3_600_000 });

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

/**
 * The server's clock, read from the database and never from `Date.now()`.
 *
 * SYNC.md requires this: a skewed application host could hand out a snapshot
 * ahead of the data, which would run the client's cursor into the future and
 * hide every subsequent change. The database clock is the same clock that stamps
 * `updated_at`, so the two cannot disagree.
 *
 * @returns {Promise<string>} ISO-8601, which is also the response's `serverTime`.
 */
async function readSnapshot() {
  const rows = await prisma.$queryRaw`
    SELECT (now() - make_interval(secs => ${SNAPSHOT_LAG_SECONDS}))::timestamptz AS snapshot
  `;
  return iso(rows[0].snapshot);
}

/** Opens a run: decides the window, stamps the snapshot, starts at generics. */
async function beginRun(since) {
  const snapshot = await readSnapshot();
  const isFullResync = since != null && Date.parse(since) < Date.parse(snapshot) - RETENTION_DAYS * 86_400_000;

  return newCursor({
    // A full resync widens the window to everything, so `since` is dropped
    // rather than merely ignored by the query.
    since: isFullResync ? null : since,
    snapshot,
    stage: STAGE_GENERICS,
    isFullResync,
  });
}

// ---------------------------------------------------------------------------
// Paged queries
// ---------------------------------------------------------------------------

/**
 * Keyset pagination expressed as an OR rather than a row-wise `(updated_at, id)
 * > ($1, $2)` comparison.
 *
 * Row-wise is the textbook form and needs no help from the planner, but it means
 * hand-written SQL and a hand-maintained snake_case mapping into the DTOs. With
 * the composite indexes in `phase2-sync-indexes.sql` this OR form reaches the
 * same plan: Postgres walks `(updated_at, id)` forward from `since` in index
 * order, the keyset test passes for every row from the resume position onward,
 * and the LIMIT stops the scan after one page. The rows before that position are
 * the only ones filtered, and they are never visited.
 *
 * @param {{since: string|null, snapshot: string, updatedAt: string|null, id: string|null}} state
 * @param {'id'|'genericId'} keyField - The table's primary key column. The two
 *   sync tables disagree here in two ways: `Medicine.id` is a UUID and
 *   `Generic.genericId` is an int, and Prisma rejects both a filter on a field
 *   the model does not have and a string where an Int is expected.
 *
 *   The cursor keeps the id as a string in both stages so it has one shape
 *   across two key types; the int is reconstructed here.
 */
function keyset(state, keyField) {
  if (!state.updatedAt || state.id === null) return {};

  let keyValue = state.id;
  if (keyField === 'genericId') {
    keyValue = Number(state.id);
    // A non-numeric id here means a hand-crafted token. Dropping the keyset
    // re-sends this stage from its start, which the client absorbs as a
    // duplicate upsert; passing NaN to Prisma would be a 500.
    if (!Number.isSafeInteger(keyValue)) return {};
  }

  return {
    OR: [
      { updatedAt: { gt: new Date(state.updatedAt) } },
      { updatedAt: new Date(state.updatedAt), [keyField]: { gt: keyValue } },
    ],
  };
}

async function queryGenerics(state) {
  return prisma.generic.findMany({
    where: {
      ...window(state),
      ...keyset(state, 'genericId'),
    },
    orderBy: [{ updatedAt: 'asc' }, { genericId: 'asc' }],
    take: PAGE_SIZE,
    select: GENERIC_SELECT,
  });
}

async function queryMedicines(state) {
  return prisma.medicine.findMany({
    where: {
      ...window(state),
      ...keyset(state, 'id'),
    },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: PAGE_SIZE,
    select: MEDICINE_SELECT,
  });
}

/** The half-open window every page query is bounded by. `snapshot` is what
 *  makes the run's coverage provable; see the note in cursor.js. */
function window(state) {
  return {
    updatedAt: {
      ...(state.since ? { gt: new Date(state.since) } : {}),
      lte: new Date(state.snapshot),
    },
  };
}

// ---------------------------------------------------------------------------
// Delta
// ---------------------------------------------------------------------------

/**
 * One page of the delta.
 *
 * @param {{since?: string|null, cursor?: import('./cursor').SyncCursor|null}} params
 * @returns {Promise<Object>} The `{ nextCursor, serverTime, isFullResync,
 *   medicines, generics }` body the client decodes in SyncDeltaPage.fromJson.
 */
async function fetchDelta({ since = null, cursor = null } = {}) {
  const state = cursor ?? (await beginRun(since));

  let rows;
  let nextCursor;

  if (state.stage === STAGE_GENERICS) {
    rows = await queryGenerics(state);

    if (rows.length < PAGE_SIZE) {
      // Generics are exhausted. Hand the client a medicines-stage cursor even
      // when no medicines changed: it costs one extra round trip and saves a
      // second "is anything left?" query here, which would have to be a
      // count() on the same window.
      nextCursor = newCursor({
        ...state, stage: STAGE_MEDICINES, updatedAt: null, id: null,
      });
    } else {
      const last = rows[rows.length - 1];
      nextCursor = newCursor({
        ...state,
        stage: STAGE_GENERICS,
        updatedAt: iso(last.updatedAt),
        id: String(last.genericId),
      });
    }
  } else {
    rows = await queryMedicines(state);

    if (rows.length < PAGE_SIZE) {
      nextCursor = null; // short page: the window is drained, this is the last
    } else {
      const last = rows[rows.length - 1];
      nextCursor = newCursor({
        ...state,
        stage: STAGE_MEDICINES,
        updatedAt: iso(last.updatedAt),
        id: last.id,
      });
    }
  }

  const isGenericsPage = state.stage === STAGE_GENERICS;

  return {
    nextCursor: nextCursor ? encode(nextCursor) : null,
    // Same value on every page of the run. The client stores this once the last
    // page commits and sends it back as the next `since`.
    serverTime: state.snapshot,
    isFullResync: state.isFullResync,
    generics: isGenericsPage ? rows.map(toGenericDto) : [],
    medicines: isGenericsPage ? [] : rows.map(toMedicineDto),
  };
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * `GET /api/sync/manifest` — `[[remoteId, contentHash], ...]` for every
 * medicine, as one JSON array.
 *
 * Not paged: the client decodes the whole body as a single list and compares it
 * against its local rows in one pass. At ~21.7k rows that is around 1MB, which
 * is why this is a repair-only endpoint rather than part of the 15-minute loop.
 *
 * **Soft-deleted medicines are included.** The client's `missingLocally` counts
 * rows it knows that the manifest does not list, and treats that as "the server
 * removed this outright — something a cursor can never report". Folding soft
 * deletes into the same counter would dilute exactly the signal Phase 6's
 * ~20% row-count guard relies on. Their `isDeleted` flag is inside the hash, so
 * a device that has not yet seen a soft delete still shows up as `mismatched`.
 *
 * @returns {Promise<{entries: Array<[string, string]>, etag: string}>}
 */
async function getManifest() {
  const cached = manifestCache;
  const now = Date.now();
  if (cached && now - cached.at < MANIFEST_TTL_MS) return cached.value;

  const rows = await prisma.medicine.findMany({
    select: MEDICINE_SELECT,
    orderBy: { id: 'asc' },
  });

  // Ascending id so the ETag is stable regardless of physical row order.
  const entries = rows.map((row) => {
    const dto = toMedicineDto(row);
    return [dto.id, computeMedicineHash(dto)];
  });

// Ids and hashes are variable-length, so the digest needs a separator: without
  // one, the pairs `["ab", "c"]` and `["a", "bc"]` would concatenate to the same
  // bytes and two different manifests could share an ETag.
  const SEP = String.fromCharCode(0x1f);
  const digest = crypto.createHash('sha256');
  for (const [id, hash] of entries) {
    digest.update(id).update(SEP).update(hash).update(SEP);
  }

  const value = { entries, etag: `"${digest.digest('hex').slice(0, 32)}"` };
  manifestCache = { at: now, value };
  return value;
}

// Module scope survives warm invocations of the same serverless instance, which
// is where the savings are; a cold start recomputes.
let manifestCache = null;

function intFromEnv(name, fallback, { min, max }) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    console.warn(`${name}=${raw} is out of range [${min}, ${max}]; using ${fallback}.`);
    return fallback;
  }
  return value;
}

module.exports = {
  fetchDelta,
  getManifest,
  readSnapshot,
  PAGE_SIZE,
  SNAPSHOT_LAG_SECONDS,
  RETENTION_DAYS,
  MANIFEST_TTL_MS,
};