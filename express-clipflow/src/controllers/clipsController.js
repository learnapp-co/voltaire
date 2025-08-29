const { Clip, ClipStatus } = require('../models/Clip');
const clipService = require('../services/clipService');
const awsService = require('../services/awsService');
const videoService = require('../services/videoService');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * POST /clips - Create new clip project
 */
const createClipProject = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { title, rawFileUrl, srtContent } = req.body;
    const userId = req.user.id;

    logger.info(`Creating clip project: ${title} for user: ${userId}`);

    // Handle file uploads (video and SRT)
    let videoFileUrl = rawFileUrl;
    let srtFileUrl = null;

    // Upload video file to AWS S3 if it's a local file
    if (req.files?.videoFile) {
      const uploadResult = await awsService.uploadVideo(req.files.videoFile, userId);
      videoFileUrl = uploadResult.url;
    }

    // Upload SRT file to AWS S3 if provided
    if (req.files?.srtFile) {
      const srtUploadResult = await awsService.uploadSRT(req.files.srtFile, userId);
      srtFileUrl = srtUploadResult.url;
    }

    // Create clip project
    const clipData = {
      userId,
      title,
      rawFileUrl: videoFileUrl,
      srtFileUrl,
      srtContent: srtContent || (req.files?.srtFile ? req.files.srtFile.buffer.toString() : ''),
      status: ClipStatus.PENDING
    };

    const clip = await clipService.createClip(clipData);

    logger.info(`Clip project created successfully: ${clip._id}`);

    res.status(201).json({
      id: clip._id,
      title: clip.title,
      status: clip.status,
      rawFileUrl: clip.rawFileUrl,
      srtFileUrl: clip.srtFileUrl,
      createdAt: clip.createdAt,
      message: 'Clip project created successfully'
    });

  } catch (error) {
    logger.error('Error creating clip project:', error);
    next(error);
  }
};

/**
 * GET /clips - Get all clip projects for user
 */
const getClipProjects = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status, search } = req.query;

    logger.info(`Getting clip projects for user: ${userId}`);

    const filters = { userId };
    if (status) filters.status = status;
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const clips = await clipService.getClips(filters, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      clips: clips.docs,
      pagination: {
        page: clips.page,
        limit: clips.limit,
        totalPages: clips.totalPages,
        totalDocs: clips.totalDocs,
        hasNextPage: clips.hasNextPage,
        hasPrevPage: clips.hasPrevPage
      }
    });

  } catch (error) {
    logger.error('Error getting clip projects:', error);
    next(error);
  }
};

/**
 * GET /clips/:id - Get specific clip project
 */
const getClipProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    logger.info(`Getting clip project: ${id} for user: ${userId}`);

    const clip = await clipService.getClipById(id, userId);
    if (!clip) {
      return res.status(404).json({ error: 'Clip project not found' });
    }

    res.json({
      id: clip._id,
      title: clip.title,
      description: clip.description,
      status: clip.status,
      rawFileUrl: clip.rawFileUrl,
      srtFileUrl: clip.srtFileUrl,
      generatedClips: clip.generatedClips,
      totalDuration: clip.totalDuration,
      totalTokensUsed: clip.totalTokensUsed,
      estimatedCost: clip.estimatedCost,
      createdAt: clip.createdAt,
      updatedAt: clip.updatedAt
    });

  } catch (error) {
    logger.error('Error getting clip project:', error);
    next(error);
  }
};

/**
 * PUT /clips/:id - Update clip project
 */
const updateClipProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    logger.info(`Updating clip project: ${id} for user: ${userId}`);

    const clip = await clipService.updateClip(id, userId, updateData);
    if (!clip) {
      return res.status(404).json({ error: 'Clip project not found' });
    }

    logger.info(`Clip project updated successfully: ${id}`);

    res.json({
      id: clip._id,
      title: clip.title,
      description: clip.description,
      status: clip.status,
      generatedClips: clip.generatedClips,
      updatedAt: clip.updatedAt,
      message: 'Clip project updated successfully'
    });

  } catch (error) {
    logger.error('Error updating clip project:', error);
    next(error);
  }
};

/**
 * POST /clips/:id/generate - Generate clips based on timestamps
 */
const generateClips = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { timestamps, quality = 'medium', format = 'mp4', overwrite = false } = req.body;

    logger.info(`Generating clips for project: ${id} by user: ${userId}`);

    // Validate timestamps
    if (!timestamps || !Array.isArray(timestamps) || timestamps.length === 0) {
      return res.status(400).json({
        error: 'Timestamps array is required and must not be empty'
      });
    }

    // Get clip project
    const clip = await clipService.getClipById(id, userId);
    if (!clip) {
      return res.status(404).json({ error: 'Clip project not found' });
    }

    if (!clip.rawFileUrl && !clip.awsFileUrl) {
      return res.status(400).json({ error: 'No video file found for clip generation' });
    }

    // Update status to generating
    await clipService.updateClip(id, userId, { 
      status: ClipStatus.GENERATING,
      generationStartedAt: new Date()
    });

    // Generate clips using video service
    const generationResult = await videoService.generateClipsFromTimestamps({
      sourceVideoUrl: clip.awsFileUrl || clip.rawFileUrl,
      timestamps,
      quality,
      format,
      overwrite,
      userId,
      projectId: id
    });

    // Update clip with generated clips
    const updateData = {
      generatedClips: overwrite ? generationResult.clips : [
        ...(clip.generatedClips || []),
        ...generationResult.clips
      ],
      status: ClipStatus.COMPLETED,
      completedAt: new Date()
    };

    const updatedClip = await clipService.updateClip(id, userId, updateData);

    logger.info(`Clip generation completed for project: ${id}`);

    res.json({
      id: updatedClip._id,
      status: updatedClip.status,
      selectedTheme: {
        title: 'Custom Timestamps',
        description: 'Clips generated from provided timestamps',
        angle: 'Custom'
      },
      requestedClipCount: timestamps.length,
      generatedClips: generationResult.clips,
      totalTokensUsed: 0, // No AI tokens used for manual generation
      estimatedCost: 0,
      generationCompletedAt: new Date(),
      message: `Generated ${generationResult.successCount} clips successfully`
    });

  } catch (error) {
    logger.error('Error generating clips:', error);
    
    // Update clip status to failed
    try {
      await clipService.updateClip(req.params.id, req.user.id, { 
        status: ClipStatus.FAILED,
        errorMessage: error.message 
      });
    } catch (updateError) {
      logger.error('Failed to update clip status to failed:', updateError);
    }
    
    next(error);
  }
};

/**
 * DELETE /clips/:id - Delete clip project
 */
const deleteClipProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    logger.info(`Deleting clip project: ${id} for user: ${userId}`);

    const deleted = await clipService.deleteClip(id, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Clip project not found' });
    }

    // Clean up associated files from AWS S3
    try {
      await awsService.deleteClipFiles(deleted);
    } catch (cleanupError) {
      logger.warn('Failed to clean up AWS files:', cleanupError);
      // Don't fail the delete operation if file cleanup fails
    }

    logger.info(`Clip project deleted successfully: ${id}`);

    res.json({
      message: 'Clip project deleted successfully',
      deletedId: id
    });

  } catch (error) {
    logger.error('Error deleting clip project:', error);
    next(error);
  }
};

module.exports = {
  createClipProject,
  getClipProjects,
  getClipProject,
  updateClipProject,
  generateClips,
  deleteClipProject
};
