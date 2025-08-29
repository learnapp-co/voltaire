const { Clip } = require('../models/Clip');
const logger = require('../utils/logger');

/**
 * Create a new clip project
 */
const createClip = async (clipData) => {
  try {
    const clip = new Clip(clipData);
    await clip.save();
    
    logger.info(`Clip created successfully: ${clip._id}`);
    return clip;
  } catch (error) {
    logger.error('Error creating clip:', error);
    throw error;
  }
};

/**
 * Get clips with pagination and filters
 */
const getClips = async (filters = {}, options = {}) => {
  try {
    const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
    
    const clips = await Clip.find(filters)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email')
      .exec();

    const total = await Clip.countDocuments(filters);
    const totalPages = Math.ceil(total / limit);

    return {
      docs: clips,
      totalDocs: total,
      limit,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null
    };
  } catch (error) {
    logger.error('Error getting clips:', error);
    throw error;
  }
};

/**
 * Get clip by ID and user ID
 */
const getClipById = async (clipId, userId) => {
  try {
    const clip = await Clip.findOne({ 
      _id: clipId, 
      userId 
    }).populate('userId', 'name email');
    
    return clip;
  } catch (error) {
    logger.error('Error getting clip by ID:', error);
    throw error;
  }
};

/**
 * Update clip by ID and user ID
 */
const updateClip = async (clipId, userId, updateData) => {
  try {
    const clip = await Clip.findOneAndUpdate(
      { _id: clipId, userId },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (clip) {
      logger.info(`Clip updated successfully: ${clipId}`);
    }
    
    return clip;
  } catch (error) {
    logger.error('Error updating clip:', error);
    throw error;
  }
};

/**
 * Delete clip by ID and user ID
 */
const deleteClip = async (clipId, userId) => {
  try {
    const clip = await Clip.findOneAndDelete({ 
      _id: clipId, 
      userId 
    });
    
    if (clip) {
      logger.info(`Clip deleted successfully: ${clipId}`);
    }
    
    return clip;
  } catch (error) {
    logger.error('Error deleting clip:', error);
    throw error;
  }
};

/**
 * Add generated clip to project
 */
const addGeneratedClip = async (clipId, userId, generatedClipData) => {
  try {
    const clip = await Clip.findOneAndUpdate(
      { _id: clipId, userId },
      { 
        $push: { generatedClips: generatedClipData },
        updatedAt: new Date()
      },
      { new: true }
    );
    
    return clip;
  } catch (error) {
    logger.error('Error adding generated clip:', error);
    throw error;
  }
};

/**
 * Update generated clip status
 */
const updateGeneratedClipStatus = async (clipId, userId, generatedClipId, status, error = null) => {
  try {
    const updateData = {
      'generatedClips.$.processingStatus': status,
      updatedAt: new Date()
    };
    
    if (error) {
      updateData['generatedClips.$.processingError'] = error;
    }
    
    const clip = await Clip.findOneAndUpdate(
      { 
        _id: clipId, 
        userId,
        'generatedClips.clipId': generatedClipId
      },
      updateData,
      { new: true }
    );
    
    return clip;
  } catch (error) {
    logger.error('Error updating generated clip status:', error);
    throw error;
  }
};

/**
 * Get clip statistics for user
 */
const getClipStatistics = async (userId) => {
  try {
    const stats = await Clip.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          completedProjects: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalGeneratedClips: { $sum: { $size: '$generatedClips' } },
          totalDuration: { $sum: '$totalDuration' },
          totalTokensUsed: { $sum: '$totalTokensUsed' },
          totalCost: { $sum: '$estimatedCost' }
        }
      }
    ]);

    // Get status distribution
    const statusStats = await Clip.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = stats[0] || {
      totalProjects: 0,
      completedProjects: 0,
      totalGeneratedClips: 0,
      totalDuration: 0,
      totalTokensUsed: 0,
      totalCost: 0
    };

    result.statusDistribution = statusStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    return result;
  } catch (error) {
    logger.error('Error getting clip statistics:', error);
    throw error;
  }
};

/**
 * Search clips by text
 */
const searchClips = async (userId, searchText, options = {}) => {
  try {
    const { page = 1, limit = 10 } = options;
    
    const searchFilters = {
      userId,
      $or: [
        { title: { $regex: searchText, $options: 'i' } },
        { description: { $regex: searchText, $options: 'i' } },
        { 'generatedClips.title': { $regex: searchText, $options: 'i' } },
        { 'generatedClips.description': { $regex: searchText, $options: 'i' } }
      ]
    };

    return getClips(searchFilters, { page, limit });
  } catch (error) {
    logger.error('Error searching clips:', error);
    throw error;
  }
};

module.exports = {
  createClip,
  getClips,
  getClipById,
  updateClip,
  deleteClip,
  addGeneratedClip,
  updateGeneratedClipStatus,
  getClipStatistics,
  searchClips
};
