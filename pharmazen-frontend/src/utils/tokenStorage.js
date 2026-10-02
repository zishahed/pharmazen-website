/**
 * Access token storage.
 *
 * The backend issues the access token in the login response body (it says "also
 * send in response for mobile apps") and additionally sets an httpOnly cookie.
 * Only the body copy is usable from this app: vercel.app is on the Public
 * Suffix List, so pharmazen.vercel.app and pharmazen-backend.vercel.app are
 * separate sites, and a SameSite=Strict cookie is never sent between them.
 *
 * Tradeoff worth stating plainly: an httpOnly cookie is not readable by
 * JavaScript and so is not exposed to XSS, whereas this is. It is the lesser
 * risk here only because the cookie cannot cross-site at all. The durable fix is
 * SameSite=None; Secure on the auth cookies -- see the note in auth.controller.js.
 */

const TOKEN_KEY = 'pharmazen.accessToken';
const USER_KEY = 'pharmazen.user';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private browsing modes can throw on access rather than return null.
    return null;
  }
};

const write = (key, value) => {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    /* nothing useful to do; the request will simply go out unauthenticated */
  }
};

export const getAccessToken = () => read(TOKEN_KEY);
export const setAccessToken = (token) => write(TOKEN_KEY, token);

export const getStoredUser = () => {
  const raw = read(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setStoredUser = (user) =>
  write(USER_KEY, user ? JSON.stringify(user) : null);

export const clearAuth = () => {
  write(TOKEN_KEY, null);
  write(USER_KEY, null);
};