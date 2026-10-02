import axios from 'axios';
import { getAccessToken, clearAuth } from '../utils/tokenStorage';
import { refreshAccessToken } from './session';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://pharmazen-backend.vercel.app/api',
  withCredentials: true, // For future cookie-based auth
});

// Request interceptor
axiosClient.interceptors.request.use(
  (config) => {
    // The httpOnly auth cookie cannot cross from pharmazen.vercel.app to
    // pharmazen-backend.vercel.app (vercel.app is a public suffix, and the
    // cookie is SameSite=Strict), so the token from the login body is the only
    // credential that reaches the API.
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // An access token lasts 15 minutes. Refresh once and replay rather than
    // logging the user out mid-checkout. _retried guards against a refresh
    // that returns 401 again and looping forever.
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return axiosClient(original);
      } catch {
        clearAuth();
      }
    }

    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
