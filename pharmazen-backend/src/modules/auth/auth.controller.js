const authService = require('./auth.service');

/**
 * Cookie policy.
 *
 * vercel.app is on the Public Suffix List, so pharmazen.vercel.app and
 * pharmazen-backend.vercel.app are separate sites and the browser will not send
 * a SameSite=Strict cookie between them. With Strict, every authenticated call
 * arrived with no credential at all and 401'd, while the UI still looked logged
 * in because that state came from React rather than the server.
 *
 * SameSite=None is the only value that works cross-site, and browsers require
 * Secure alongside it -- hence both are tied to production. On plain-http
 * localhost, 'lax' keeps local development working.
 */
const isProduction = process.env.NODE_ENV === 'production';
const cookieBase = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
};

const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Password validation (minimum 8 characters, alphanumeric)
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    const alphanumericRegex = /^(?=.*[a-zA-Z])(?=.*\d)/;
    if (!alphanumericRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be alphanumeric (contain both letters and numbers)',
      });
    }

    const user = await authService.register({ name, email, password, role });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const result = await authService.login({ email, password });

    // Set httpOnly cookies
    res.cookie('accessToken', result.accessToken, {
      ...cookieBase,
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieBase,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken, // Also send in response for mobile apps
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Login failed',
    });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    // Set new cookies
    res.cookie('accessToken', result.accessToken, {
      ...cookieBase,
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });

    res.cookie('refreshToken', result.refreshToken, {
      ...cookieBase,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Token refresh failed',
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    await authService.logout(refreshToken);

    // Clear cookies
    // Options must match those used when setting, otherwise the browser keeps
    // the original cookie and the "logout" silently does nothing.
    res.clearCookie('accessToken', { ...cookieBase, path: '/' });
    res.clearCookie('refreshToken', { ...cookieBase, path: '/' });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data',
    });
  }
};

/**
 * Check if user is authenticated
 * GET /api/auth/check
 */
const checkAuth = async (req, res) => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];
    if (token) {
      const { verifyAccessToken } = require('../../utils/jwt');
      try {
        verifyAccessToken(token);
        return res.json({ success: true, authenticated: true });
      } catch {
        return res.json({ success: true, authenticated: false });
      }
    }
    res.json({ success: true, authenticated: false });
  } catch (error) {
    res.json({ success: true, authenticated: false });
  }
};

/**
 * Register staff (pharmacist or admin) - admin only
 * POST /api/auth/admin/register-staff
 */
const registerStaff = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Password validation (minimum 8 characters, alphanumeric)
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    const alphanumericRegex = /^(?=.*[a-zA-Z])(?=.*\d)/;
    if (!alphanumericRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be alphanumeric (contain both letters and numbers)',
      });
    }

    // Role validation
    if (role !== 'pharmacist' && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Only pharmacist and admin roles are allowed',
      });
    }

    const user = await authService.registerStaff({ name, email, password, role });

    res.status(201).json({
      success: true,
      message: 'Staff member registered successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Register staff error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Staff registration failed',
    });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
  registerStaff,
  checkAuth,
};
