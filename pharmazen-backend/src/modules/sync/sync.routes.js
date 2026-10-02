const express = require('express');
const rateLimit = require('express-rate-limit');
const syncController = require('./sync.controller');

const router = express.Router();

/**
 * Public sync endpoints.
 *
 * No `authenticate`: the catalogue is public data and the app must be able to
 * sync before a user has ever logged in. Rate limiting is the substitute.
 *
 * The budget is sized around a full resync, not around an incremental sync.
 * `SYNC_PAGE_SIZE` defaults to 500, so the 21,715-row catalogue is ~44 requests
 * on a first sync and a handful afterwards. 240 requests per 5 minutes leaves
 * headroom for several full resyncs while still stopping a single client from
 * looping. express-rate-limit sends `Retry-After`, which sync_api_client.dart
 * already honours on a 429.
 */
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Keying is left at the library default, which routes through its
  // `ipKeyGenerator` and folds an IPv6 address down to its subnet prefix.
  // Passing `req.ip` through by hand is not equivalent: a single IPv6 client is
  // handed a whole /64 and could rotate addresses inside it to walk past the
  // limit, so express-rate-limit v8 refuses to start with a raw `req.ip`
  // keyGenerator (ERR_ERL_KEY_GEN_IPV6) rather than serve a limit that is easy
  // to evade.
  message: { success: false, error: 'Too many sync requests. Try again shortly.' },
});

// GET /api/sync - One page of the ?since= delta
router.get('/', limiter, syncController.getDelta);

// GET /api/sync/manifest - [[remoteId, contentHash], ...] for repair only
router.get('/manifest', limiter, syncController.getManifest);

module.exports = router;