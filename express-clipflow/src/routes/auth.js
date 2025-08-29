const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { asyncErrorHandler, validationErrorHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(validationErrorHandler(errors));
  }
  next();
};

/**
 * POST /auth/register - Register new user
 */
router.post('/register',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .trim()
  ],
  validateRequest,
  asyncErrorHandler(authController.register)
);

/**
 * POST /auth/login - Login user
 */
router.post('/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  validateRequest,
  asyncErrorHandler(authController.login)
);

/**
 * GET /auth/me - Get current user profile
 */
router.get('/me',
  authMiddleware,
  asyncErrorHandler(authController.getProfile)
);

/**
 * PUT /auth/me - Update user profile
 */
router.put('/me',
  authMiddleware,
  [
    body('name')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .trim(),
    body('preferences')
      .optional()
      .isObject()
      .withMessage('Preferences must be an object'),
    body('preferences.defaultModel')
      .optional()
      .isString()
      .withMessage('Default model must be a string'),
    body('preferences.defaultQuality')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Default quality must be low, medium, or high'),
    body('preferences.notifications')
      .optional()
      .isObject()
      .withMessage('Notifications preferences must be an object'),
    body('preferences.notifications.email')
      .optional()
      .isBoolean()
      .withMessage('Email notification preference must be a boolean'),
    body('preferences.notifications.clipComplete')
      .optional()
      .isBoolean()
      .withMessage('Clip complete notification preference must be a boolean')
  ],
  validateRequest,
  asyncErrorHandler(authController.updateProfile)
);

/**
 * POST /auth/change-password - Change user password
 */
router.post('/change-password',
  authMiddleware,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      })
  ],
  validateRequest,
  asyncErrorHandler(authController.changePassword)
);

/**
 * POST /auth/forgot-password - Request password reset
 */
router.post('/forgot-password',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
  ],
  validateRequest,
  asyncErrorHandler(async (req, res, next) => {
    // Password reset implementation would go here
    // For now, just acknowledge the request
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent',
      email: req.body.email
    });
  })
);

/**
 * POST /auth/reset-password - Reset password with token
 */
router.post('/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      })
  ],
  validateRequest,
  asyncErrorHandler(async (req, res, next) => {
    // Password reset implementation would go here
    res.json({
      message: 'Password has been reset successfully'
    });
  })
);

/**
 * POST /auth/verify-email - Verify email address
 */
router.post('/verify-email',
  [
    body('token')
      .notEmpty()
      .withMessage('Verification token is required')
  ],
  validateRequest,
  asyncErrorHandler(async (req, res, next) => {
    // Email verification implementation would go here
    res.json({
      message: 'Email verified successfully'
    });
  })
);

/**
 * POST /auth/resend-verification - Resend email verification
 */
router.post('/resend-verification',
  authMiddleware,
  asyncErrorHandler(async (req, res, next) => {
    // Resend verification implementation would go here
    res.json({
      message: 'Verification email has been sent'
    });
  })
);

/**
 * POST /auth/logout - Logout user
 */
router.post('/logout',
  authMiddleware,
  asyncErrorHandler(authController.logout)
);

/**
 * GET /auth/usage - Get API usage statistics
 */
router.get('/usage',
  authMiddleware,
  asyncErrorHandler(async (req, res, next) => {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      subscriptionPlan: user.subscriptionPlan,
      apiUsage: user.apiUsage,
      limits: {
        free: 10,
        pro: 100,
        enterprise: 1000
      }
    });
  })
);

/**
 * POST /auth/refresh - Refresh JWT token
 */
router.post('/refresh',
  authMiddleware,
  asyncErrorHandler(async (req, res, next) => {
    const jwt = require('jsonwebtoken');
    
    // Generate new token
    const newToken = jwt.sign(
      { id: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Token refreshed successfully',
      token: newToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  })
);

module.exports = router;
