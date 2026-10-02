import {
  clearAuth,
  setAccessToken,
  setStoredUser,
} from '../utils/tokenStorage';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'https://pharmazen-backend.vercel.app/api';

/**
 * Trade the 7-day refresh cookie for a fresh 15-minute access token.
 *
 * The access token lives in localStorage because the auth cookie cannot cross
 * from pharmazen.vercel.app to pharmazen-backend.vercel.app. Since the cookie
 * policy is now SameSite=None in production, the refresh cookie does cross, so
 * an expired access token is recoverable instead of ending the session.
 *
 * Concurrent callers share one in-flight request. The refresh token is rotated
 * on use, so several simultaneous 401s each firing their own refresh would burn
 * it and lock the user out.
 */
let inFlight = null;

export const refreshAccessToken = async () => {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      // Sends the refresh cookie. Deliberately no Authorization header: this
      // call exists precisely because the access token is no longer valid.
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      clearAuth();
      throw new Error('Session expired');
    }

    const payload = await response.json();
    setAccessToken(payload.data.accessToken);
    if (payload.data.user) setStoredUser(payload.data.user);

    return payload.data.accessToken;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

export default refreshAccessToken;