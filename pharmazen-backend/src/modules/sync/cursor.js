/**
 * Opaque continuation token for `GET /api/sync?cursor=`.
 *
 * Why the token exists at all: a delta has to be read in pages, and a page
 * boundary is only stable if every page of one run shares a single snapshot
 * instant. So the token carries the window (`since`, `snapshot`) as well as the
 * position within it. The client echoes the token verbatim and never parses it.
 *
 * ## The snapshot is the whole ballgame
 *
 * `snapshot` is the server's `serverTime`, and it is the *same value* on every
 * page of a run — that is what the client stores as its next `?since=` once the
 * final page commits. SYNC.md is explicit about why the cursor may not be
 * derived from `MAX(updatedAt)` in the payload instead: a row sharing a
 * timestamp with the last row of the last page would be skipped forever.
 *
 * If the snapshot were recomputed per page, a row edited between page 1 and
 * page 5 could land *behind* the new page-5 boundary while never having been
 * returned by page 1, and the next run would ask for changes after a later
 * instant. Pinning it is what makes the run's coverage provably complete.
 *
 * ## Ordering
 *
 * Generics are paged to exhaustion before medicines begin. Order is irrelevant
 * to correctness — both phases are bounded by the same window — but it means
 * every medicine page arrives after its generics, so the client's
 * `GenericResolver` can always resolve `generic_id` against rows that are
 * already local. It also lets one stage keyset carry one table's key type
 * (generics are `generic_id INT`, medicines are `id UUID`) without a union.
 */

/** Bumped only if the token's shape changes; a v0 token is rejected outright
 *  rather than misread, because a wrong window silently loses rows. */
const CURSOR_VERSION = 1;

/** How far past the app clock a token's snapshot may sit before it is treated as
 *  forged. A snapshot is always `db now - SYNC_SNAPSHOT_LAG_SECONDS`, so in
 *  practice it is behind the app clock; this only absorbs skew between the two. */
const FUTURE_SNAPSHOT_TOLERANCE_MS = 5 * 60 * 1000;

const STAGE_GENERICS = 'g';
const STAGE_MEDICINES = 'm';

/**
 * @typedef {Object} SyncCursor
 * @property {string|null} since  Exclusive lower bound of the window, or null
 *   for a full sync. Sent as the client's `last_success_at`.
 * @property {string} snapshot  Inclusive upper bound, also the response's
 *   `serverTime`. Pinned for the whole run.
 * @property {string} stage     Which table this position belongs to.
 * @property {string|null} updatedAt  Keyset: last row's updated_at in `stage`.
 * @property {string|null} id          Keyset tiebreaker in `stage`, as a string
 *   because generics are an INT and medicines a UUID.
 * @property {boolean} isFullResync  Echoed from the first page so every page of
 *   a full resync agrees about it. The client only honours it on page 1, but a
 *   token that contradicted its own payload would be a trap for the next reader.
 */

/** @returns {SyncCursor} */
function newCursor({ since, snapshot, stage, updatedAt = null, id = null, isFullResync = false }) {
  return { since, snapshot, stage, updatedAt, id, isFullResync };
}

function encode(cursor) {
  return Buffer.from(JSON.stringify({
    v: CURSOR_VERSION,
    s: cursor.since,
    t: cursor.snapshot,
    g: cursor.stage,
    u: cursor.updatedAt,
    i: cursor.id,
    r: cursor.isFullResync ? 1 : 0,
  }), 'utf8').toString('base64url');
}

/**
 * Decodes a token, returning null for anything unusable.
 *
 * The client is public and unauthenticated, so this is untrusted input. A
 * malformed token must be answered by starting a fresh page-1 request rather
 * than by a 500 — the client's own retry would then replay the same bad token
 * forever. Callers treat null as "no cursor supplied".
 *
 * @param {string|undefined} raw
 * @returns {SyncCursor|null}
 */
function decode(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null;

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (parsed.v !== CURSOR_VERSION) return null;
  if (parsed.g !== STAGE_GENERICS && parsed.g !== STAGE_MEDICINES) return null;
  // A window with no upper bound is not a window. Without this check a token
  // carrying `t: null` would quietly widen the query to every row.
  if (typeof parsed.t !== 'string' || Number.isNaN(Date.parse(parsed.t))) return null;

  // A snapshot is the run's `serverTime`, and the client stores that as its next
  // `since`. So a snapshot dated in the future leaves that device permanently
  // unable to sync again: every later run asks for changes after an instant that
  // has not happened yet, matches nothing, and stores another future value in
  // reply. Nothing recovers from that except a reinstall, and the token is
  // unsigned, so it is not ours. Rejecting it restarts the run cleanly.
  //
  // The app clock is the right yardstick here precisely because this is a
  // rejection bound and not a value being served: the snapshot a run actually
  // reports still comes from `readSnapshot()` in sync.service.js.
  if (Date.parse(parsed.t) > Date.now() + FUTURE_SNAPSHOT_TOLERANCE_MS) return null;
  if (parsed.s !== null && (typeof parsed.s !== 'string' || Number.isNaN(Date.parse(parsed.s)))) {
    return null;
  }
  if (parsed.u !== null && (typeof parsed.u !== 'string' || Number.isNaN(Date.parse(parsed.u)))) {
    return null;
  }
  if (parsed.i !== null && typeof parsed.i !== 'string') return null;

  return {
    since: parsed.s,
    snapshot: parsed.t,
    stage: parsed.g,
    updatedAt: parsed.u,
    id: parsed.i,
    isFullResync: parsed.r === 1,
  };
}

module.exports = {
  CURSOR_VERSION,
  STAGE_GENERICS,
  STAGE_MEDICINES,
  newCursor,
  encode,
  decode,
};