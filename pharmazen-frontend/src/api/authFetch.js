import { clearAuth, getAccessToken } from '../utils/tokenStorage';
import { refreshAccessToken } from './session';

/**
 * fetch() with the Bearer token attached.
 *
 * Used by the pages that still call fetch() directly rather than going through
 * axiosClient, so the token is attached in one place instead of at every call
 * site. credentials stays whatever the caller passed: the refresh cookie may
 * become usable again if the cookie policy is relaxed, and sending it costs
 * nothing.
 */
export const authorizedFetch = async (url, options = {}) => {
  const { _retried, ...init } = options;
  const token = getAccessToken();

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // Same 15-minute expiry as the axios path: refresh once, then replay.
  if (response.status === 401 && !_retried) {
    try {
      const fresh = await refreshAccessToken();
      return fetch(url, {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${fresh}`,
        },
      });
    } catch {
      clearAuth();
    }
  }

  return response;
};

export default authorizedFetch;