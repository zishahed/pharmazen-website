import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getCurrentUser, login as loginApi, logout as logoutApi, register as registerApi } from '../api/authApi';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loginCallbacks = useRef([]);
  const logoutCallbacks = useRef([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await getCurrentUser();
      if (response.success) {
        setUser(response.data.user);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      setError(null);
      const response = await loginApi(credentials);
      if (response.success) {
        setUser(response.data.user);
        loginCallbacks.current.forEach(cb => cb());
        return { success: true };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const response = await registerApi(userData);
      if (response.success) {
        return await login({ email: userData.email, password: userData.password });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    }
  };

  const logout = async () => {
    try {
      logoutCallbacks.current.forEach(cb => cb());
      await logoutApi();
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const isAuthenticated = () => {
    return user !== null;
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  const isGuest = () => !isAuthenticated();
  const isCustomer = () => hasRole('customer');
  const isPharmacist = () => hasRole('pharmacist');
  const isAdmin = () => hasRole('admin');

  const onLogin = (callback) => {
    loginCallbacks.current.push(callback);
    return () => {
      loginCallbacks.current = loginCallbacks.current.filter(cb => cb !== callback);
    };
  };

  const onLogout = (callback) => {
    logoutCallbacks.current.push(callback);
    return () => {
      logoutCallbacks.current = logoutCallbacks.current.filter(cb => cb !== callback);
    };
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated,
    hasRole,
    isGuest,
    isCustomer,
    isPharmacist,
    isAdmin,
    onLogin,
    onLogout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
