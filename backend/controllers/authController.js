const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
} = require('../utils/jwt');
const { logAction } = require('../utils/audit');
const { sendEmail, passwordResetTemplate } = require('../utils/email');

const refreshCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const allowedSelfRegisterRoles = ['applicant'];
    const assignedRole = allowedSelfRegisterRoles.includes(role)
      ? role
      : 'applicant';

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: assignedRole,
    });

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    await logAction({
      actor: user._id,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      targetType: 'User',
      targetId: user._id,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      message: 'Registration successful',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isFirstLogin: true,
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isFirstLogin = !user.lastLoginAt;
    user.lastLoginAt = new Date();
    await user.save();

    await logAction({
      actor: user._id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      targetType: 'User',
      targetId: user._id,
      ipAddress: req.ip,
    });

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    return res.status(200).json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isFirstLogin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
};

const logout = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api/auth',
  });
  return res.status(200).json({ message: 'Logout successful' });
};

const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const accessToken = generateAccessToken(user._id, user.role);

    return res.status(200).json({
      message: 'Token refreshed',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, university } = req.body;

    if (!['university', 'lgc'].includes(role)) {
      return res.status(400).json({ error: 'Role must be university or lgc' });
    }
    if (role === 'university' && !university) {
      return res.status(400).json({ error: 'University ID is required for university role' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const userData = { email, password, firstName, lastName, role };
    if (role === 'university') userData.university = university;

    const user = await User.create(userData);

    await logAction({
      actor: req.user._id,
      actorRole: req.user.role,
      action: 'USER_CREATED_BY_ADMIN',
      targetType: 'User',
      targetId: user._id,
      metadata: { createdRole: role, email: user.email },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        university: user.university,
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'User creation failed' });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

      sendEmail({
        to: user.email,
        subject: 'LRFAP — Password reset request',
        html: passwordResetTemplate({
          firstName: user.firstName,
          resetLink,
        }),
      }).catch((err) => console.error('Password reset email failed:', err.message));

      await logAction({
        actor: user._id,
        actorRole: user.role,
        action: 'PASSWORD_RESET_REQUESTED',
        targetType: 'User',
        targetId: user._id,
        ipAddress: req.ip,
      });
    }

    return res.status(200).json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Password reset request failed' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await logAction({
      actor: user._id,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'User',
      targetId: user._id,
      ipAddress: req.ip,
    });

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Password reset failed' });
  }
};

module.exports = {
  register,
  login,
  logout,
  refresh,
  createUser,
  forgotPassword,
  resetPassword,
};