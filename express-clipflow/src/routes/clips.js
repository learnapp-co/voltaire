const express = require('express');
const { body, param, query } = require('express-validator');
const multer = require('multer');
const clipsController = require('../controllers/clipsController');
const { asyncErrorHandler, validationErrorHandler } = require('../middleware/errorHandler');
const { requireSubscription, subscriptionRateLimit } = require('../middleware/auth');
const awsService = require('../services/awsService');
const { validationResult } = require('express-validator');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB for videos
    files: 2 // Video + SRT file
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'videoFile') {
      const allowedTypes = /mp4|mov|avi|mkv|webm/;
      const mimeType = allowedTypes.test(file.mimetype);
      const extName = allowedTypes.test(file.originalname.toLowerCase());
      
      if (mimeType && extName) {
        return cb(null, true);
      } else {
        cb(new Error('Only video files are allowed for videoFile'));
      }
    } else if (file.fieldname === 'srtFile') {
      const allowedTypes = /srt|txt/;
      const extName = allowedTypes.test(file.originalname.toLowerCase());
      
      if (extName || file.mimetype === 'text/plain') {
        return cb(null, true);
      } else {
        cb(new Error('Only SRT files are allowed for srtFile'));
      }
    }
    
    cb(new Error('Invalid field name'));
  }
});

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(validationErrorHandler(errors));
  }
  next();
};

/**
 * POST /clips - Create new clip project
 */
router.post('/',
  subscriptionRateLimit,
  upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'srtFile', maxCount: 1 }
  ]),
  [
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('rawFileUrl')
      .optional()
      .isURL()
      .withMessage('Raw file URL must be a valid URL'),
    body('srtContent')
      .optional()
      .isString()
      .withMessage('SRT content must be a string')
  ],
  validateRequest,
  asyncErrorHandler(clipsController.createClipProject)
);

/**
 * GET /clips - Get all clip projects for user
 */
router.get('/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('status')
      .optional()
      .isIn(['pending', 'analyzing', 'ready_for_generation', 'generating', 'completed', 'failed'])
      .withMessage('Invalid status value'),
    query('search')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters')
  ],
  validateRequest,
  asyncErrorHandler(clipsController.getClipProjects)
);

/**
 * GET /clips/:id - Get specific clip project
 */
router.get('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid clip ID format')
  ],
  validateRequest,
  asyncErrorHandler(clipsController.getClipProject)
);

/**
 * PUT /clips/:id - Update clip project
 */
router.put('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid clip ID format'),
    body('title')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('status')
      .optional()
      .isIn(['pending', 'analyzing', 'ready_for_generation', 'generating', 'completed', 'failed'])
      .withMessage('Invalid status value'),
    body('generatedClips')
      .optional()
      .isArray()
      .withMessage('Generated clips must be an array'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object')
  ],
  validateRequest,
  asyncErrorHandler(clipsController.updateClipProject)
);

/**
 * POST /clips/:id/generate - Generate clips based on timestamps
 */
router.post('/:id/generate',
  requireSubscription('pro'), // Require pro subscription for clip generation
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid clip ID format'),
    body('timestamps')
      .isArray({ min: 1 })
      .withMessage('Timestamps array is required and must not be empty'),
    body('timestamps.*.id')
      .notEmpty()
      .withMessage('Each timestamp must have an ID'),
    body('timestamps.*.title')
      .notEmpty()
      .withMessage('Each timestamp must have a title'),
    body('timestamps.*.startTime')
      .isFloat({ min: 0 })
      .withMessage('Start time must be a non-negative number'),
    body('timestamps.*.endTime')
      .isFloat({ min: 0 })
      .withMessage('End time must be a non-negative number'),
    body('timestamps.*.description')
      .optional()
      .isString()
      .withMessage('Description must be a string'),
    body('quality')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Quality must be low, medium, or high'),
    body('format')
      .optional()
      .isIn(['mp4', 'mov', 'avi'])
      .withMessage('Format must be mp4, mov, or avi'),
    body('overwrite')
      .optional()
      .isBoolean()
      .withMessage('Overwrite must be a boolean'),
    body('includeFades')
      .optional()
      .isBoolean()
      .withMessage('Include fades must be a boolean')
  ],
  validateRequest,
  // Custom validation for timestamp logic
  (req, res, next) => {
    const { timestamps } = req.body;
    
    for (const timestamp of timestamps) {
      if (timestamp.endTime <= timestamp.startTime) {
        return res.status(400).json({
          error: 'Validation failed',
          details: {
            field: 'timestamps',
            message: `End time must be greater than start time for clip: ${timestamp.id}`
          }
        });
      }
      
      if (timestamp.endTime - timestamp.startTime > 300) { // 5 minutes max
        return res.status(400).json({
          error: 'Validation failed',
          details: {
            field: 'timestamps',
            message: `Clip duration must not exceed 5 minutes for clip: ${timestamp.id}`
          }
        });
      }
    }
    
    next();
  },
  asyncErrorHandler(clipsController.generateClips)
);

/**
 * DELETE /clips/:id - Delete clip project
 */
router.delete('/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid clip ID format')
  ],
  validateRequest,
  asyncErrorHandler(clipsController.deleteClipProject)
);

/**
 * POST /clips/:id/srt/upload - Upload SRT file for existing project
 */
router.post('/:id/srt/upload',
  upload.single('srtFile'),
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid clip ID format')
  ],
  validateRequest,
  asyncErrorHandler(async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'SRT file is required'
      });
    }

    // This would be implemented in the controller
    // For now, just acknowledge the upload
    res.json({
      message: 'SRT file uploaded successfully',
      fileName: req.file.originalname,
      size: req.file.size
    });
  })
);

/**
 * GET /clips/:id/download/:clipId - Download generated clip
 */
router.get('/:id/download/:clipId',
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid clip ID format'),
    param('clipId')
      .notEmpty()
      .withMessage('Clip ID is required')
  ],
  validateRequest,
  asyncErrorHandler(async (req, res, next) => {
    // This would generate a signed download URL
    // Implementation would be in the controller
    res.json({
      downloadUrl: 'https://example.com/signed-download-url',
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    });
  })
);

/**
 * GET /clips/stats/overview - Get user's clip statistics
 */
router.get('/stats/overview',
  asyncErrorHandler(async (req, res, next) => {
    const clipService = require('../services/clipService');
    const stats = await clipService.getClipStatistics(req.user.id);
    res.json(stats);
  })
);

module.exports = router;
