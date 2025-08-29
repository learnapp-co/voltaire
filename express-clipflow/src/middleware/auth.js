const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. No valid token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          error: 'Access denied. User not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          error: 'Access denied. Account is deactivated.',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Increment API usage
      await user.incrementApiUsage();

      // Add user to request object
      req.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionPlan: user.subscriptionPlan
      };

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Access denied. Token has expired.',
          code: 'TOKEN_EXPIRED'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Access denied. Invalid token.',
          code: 'INVALID_TOKEN'
        });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Internal server error during authentication',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          subscriptionPlan: user.subscriptionPlan
        };
      }
    } catch (jwtError) {
      // Silently ignore token errors for optional auth
      logger.debug('Optional auth token error:', jwtError.message);
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue without authentication
  }
};

/**
 * Admin role requirement middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Subscription plan requirement middleware
 */
const requireSubscription = (requiredPlan) => {
  const planHierarchy = { free: 1, pro: 2, enterprise: 3 };
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userPlanLevel = planHierarchy[req.user.subscriptionPlan] || 0;
    const requiredPlanLevel = planHierarchy[requiredPlan] || 999;

    if (userPlanLevel < requiredPlanLevel) {
      return res.status(403).json({
        error: `${requiredPlan} subscription required`,
        code: 'SUBSCRIPTION_REQUIRED',
        currentPlan: req.user.subscriptionPlan,
        requiredPlan
      });
    }

    next();
  };
};

/**
 * Rate limiting based on subscription plan
 */
const subscriptionRateLimit = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const limits = {
    free: 10,
    pro: 100,
    enterprise: 1000
  };

  const userLimit = limits[req.user.subscriptionPlan] || limits.free;
  
  // This is a simplified rate limiting check
  // In production, you'd use Redis or similar for distributed rate limiting
  if (req.user.apiUsage && req.user.apiUsage.monthlyRequests > userLimit) {
    return res.status(429).json({
      error: 'Monthly API limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      limit: userLimit,
      used: req.user.apiUsage.monthlyRequests
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  optionalAuth,
  requireAdmin,
  requireSubscription,
  subscriptionRateLimit
};
