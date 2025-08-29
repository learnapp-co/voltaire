const logger = require('../utils/logger');

/**
 * Global error handling middleware
 */
const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = {};

  // Log the error
  logger.error('Error caught by global handler:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    user: req.user?.id,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Handle different types of errors
  if (error.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation Error';
    details = {
      errors: Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }))
    };
  } else if (error.name === 'CastError') {
    // Mongoose cast error (invalid ObjectId)
    statusCode = 400;
    message = 'Invalid ID format';
    details = {
      field: error.path,
      value: error.value
    };
  } else if (error.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    message = 'Duplicate resource';
    const field = Object.keys(error.keyPattern)[0];
    details = {
      field,
      message: `${field} already exists`
    };
  } else if (error.name === 'JsonWebTokenError') {
    // JWT errors
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (error.name === 'MulterError') {
    // File upload errors
    statusCode = 400;
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large';
      details = { maxSize: error.limit };
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files';
      details = { maxCount: error.limit };
    } else {
      message = 'File upload error';
      details = { code: error.code };
    }
  } else if (error.message.includes('ENOENT')) {
    // File not found errors
    statusCode = 404;
    message = 'File not found';
  } else if (error.message.includes('EACCES')) {
    // Permission errors
    statusCode = 403;
    message = 'Permission denied';
  } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
    // Network/connection errors
    statusCode = 503;
    message = 'Service temporarily unavailable';
  } else if (error.statusCode || error.status) {
    // Custom errors with status codes
    statusCode = error.statusCode || error.status;
    message = error.message;
  } else if (error.message) {
    // Generic errors with custom messages
    message = error.message;
    
    // Determine status code based on message content
    if (message.toLowerCase().includes('not found')) {
      statusCode = 404;
    } else if (message.toLowerCase().includes('unauthorized') || 
               message.toLowerCase().includes('permission')) {
      statusCode = 403;
    } else if (message.toLowerCase().includes('invalid') || 
               message.toLowerCase().includes('bad request')) {
      statusCode = 400;
    }
  }

  // Prepare error response
  const errorResponse = {
    error: message,
    status: statusCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Add details if available
  if (Object.keys(details).length > 0) {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper to catch async route errors
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
};

/**
 * Request validation error handler
 */
const validationErrorHandler = (errors) => {
  const error = new Error('Validation failed');
  error.statusCode = 400;
  error.details = {
    errors: errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value,
      location: err.location
    }))
  };
  return error;
};

module.exports = {
  errorHandler,
  asyncErrorHandler,
  notFoundHandler,
  validationErrorHandler
};
