import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

// Create axios instance with credentials
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Register a new user
 */
export const register = async (userData) => {
  const response = await api.post('/register', userData);
  return response.data;
};

/**
 * Login user
 */
export const login = async (credentials) => {
  const response = await api.post('/login', credentials);
  return response.data;
};

/**
 * Logout user
 */
export const logout = async () => {
  const response = await api.post('/logout');
  return response.data;
};

/**
 * Refresh access token
 */
export const refreshToken = async () => {
  const response = await api.post('/refresh');
  return response.data;
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  const response = await api.get('/me');
  return response.data;
};

export default api;
