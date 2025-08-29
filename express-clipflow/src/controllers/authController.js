const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /auth/register - Register new user
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, name } = req.body;

    logger.info(`User registration attempt: ${email}`);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists with this email'
      });
    }

    // Create new user
    const user = new User({
      email,
      password,
      name
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    logger.info(`User registered successfully: ${user._id}`);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan
      }
    });

  } catch (error) {
    logger.error('Error during user registration:', error);
    next(error);
  }
};

/**
 * POST /auth/login - Login user
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    logger.info(`User login attempt: ${email}`);

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account is deactivated. Please contact support.'
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    logger.info(`User logged in successfully: ${user._id}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        lastLoginAt: user.lastLoginAt
      }
    });

  } catch (error) {
    logger.error('Error during user login:', error);
    next(error);
  }
};

/**
 * GET /auth/me - Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan,
        isEmailVerified: user.isEmailVerified,
        apiUsage: user.apiUsage,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });

  } catch (error) {
    logger.error('Error getting user profile:', error);
    next(error);
  }
};

/**
 * PUT /auth/me - Update user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { name, preferences } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    logger.info(`User profile updated: ${userId}`);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        preferences: user.preferences,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    logger.error('Error updating user profile:', error);
    next(error);
  }
};

/**
 * POST /auth/change-password - Change user password
 */
const changePassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for user: ${userId}`);

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Error changing password:', error);
    next(error);
  }
};

/**
 * POST /auth/logout - Logout user (optional - mainly for token blacklisting)
 */
const logout = async (req, res, next) => {
  try {
    // In a stateless JWT system, logout is mainly handled client-side
    // You could implement token blacklisting here if needed
    
    logger.info(`User logged out: ${req.user.id}`);

    res.json({
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Error during logout:', error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
};
