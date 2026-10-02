const syncService = require('./sync.service');
const { decode } = require('./cursor');

/**
 * GET /api/sync
 *
 * Public and unauthenticated. The catalogue is public data (the website reads
 * it anonymously), so there is nothing here to authenticate — protection comes
 * from rate limiting in sync.routes.js instead.
 */
async function getDelta(req, res) {
  try {
    const since = typeof req.query.since === 'string' && req.query.since ? req.query.since : null;
    const cursor = decode(req.query.cursor);

    // An unusable token is not an error. It means "I did not get a usable
    // position", so the run restarts from page 1. Failing instead would make
    // the client's retry replay the same bad token indefinitely, and a 500
    // would be blamed on the server for what is a malformed client request.
    if (req.query.cursor && cursor === null) {
      console.warn('Discarded an unparseable sync cursor; restarting the run.');
    }

    const page = await syncService.fetchDelta({ since, cursor });

    res.set('Cache-Control', 'no-store');
    res.json(page);
  } catch (error) {
    console.error('Error in getDelta controller:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sync delta.' });
  }
}

/**
 * GET /api/sync/manifest
 *
 * The client sends `If-None-Match` and treats a 304 as "unchanged", which is
 * the whole reason the manifest is cheap to poll: a repeat costs a 304 with no
 * body instead of ~1MB of JSON.
 */
async function getManifest(req, res) {
  try {
    const { entries, etag } = await syncService.getManifest();

    res.set('ETag', etag);
    res.set('Cache-Control', 'no-store');

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.json(entries);
  } catch (error) {
    console.error('Error in getManifest controller:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sync manifest.' });
  }
}

module.exports = { getDelta, getManifest };