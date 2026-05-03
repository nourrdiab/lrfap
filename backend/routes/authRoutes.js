const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  register,
  login,
  logout,
  refresh,
  createUser,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new applicant account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       201: { description: Registration successful }
 *       409: { description: Email already registered }
 */
router.post('/register', authLimiter, register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a JWT access token
 *     responses:
 *       200: { description: Login successful, access token returned }
 *       401: { description: Invalid credentials }
 */
router.post('/login', authLimiter, login);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and clear refresh token cookie
 *     responses:
 *       200: { description: Logout successful }
 */
router.post('/logout', logout);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Issue a new access token using the refresh cookie
 *     responses:
 *       200: { description: New access token issued }
 *       401: { description: Invalid or missing refresh token }
 */
router.post('/refresh', refresh);

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Reset email sent if account exists }
 */
router.post('/forgot-password', authLimiter, forgotPassword);

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a token from the reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password reset successful }
 *       400: { description: Invalid or expired token }
 */
router.post('/reset-password', authLimiter, resetPassword);

/**
 * @openapi
 * /api/auth/users:
 *   post:
 *     tags: [Auth]
 *     summary: Create a university or LGC user (LGC only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: User created }
 *       403: { description: Forbidden }
 */
router.post('/users', protect, authorize('lgc'), createUser);

module.exports = router;