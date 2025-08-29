const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const awsService = require('./awsService');
const logger = require('../utils/logger');

// Set FFmpeg paths if provided in environment
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

const TEMP_DIR = process.env.TEMP_DIR || './temp';

/**
 * Ensure temp directory exists
 */
const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
};

/**
 * Download video from URL to temp file
 */
const downloadVideo = async (videoUrl) => {
  return new Promise((resolve, reject) => {
    const tempFileName = `temp_${uuidv4()}.mp4`;
    const tempFilePath = path.join(TEMP_DIR, tempFileName);

    logger.info(`Downloading video from: ${videoUrl}`);

    const command = ffmpeg(videoUrl)
      .output(tempFilePath)
      .on('end', () => {
        logger.info(`Video downloaded to: ${tempFilePath}`);
        resolve(tempFilePath);
      })
      .on('error', (error) => {
        logger.error('Error downloading video:', error);
        reject(error);
      });

    command.run();
  });
};

/**
 * Extract a single clip from video
 */
const extractClip = async (options) => {
  const {
    sourceVideoPath,
    startTime,
    endTime,
    outputPath,
    quality = 'medium',
    format = 'mp4',
    includeFades = false
  } = options;

  return new Promise((resolve, reject) => {
    ensureTempDir();

    const duration = endTime - startTime;

    logger.info(`Extracting clip: ${startTime}s to ${endTime}s (${duration}s)`);

    let command = ffmpeg(sourceVideoPath)
      .seekInput(startTime)
      .duration(duration)
      .output(outputPath);

    // Set quality settings
    switch (quality) {
      case 'low':
        command = command
          .videoBitrate('500k')
          .audioBitrate('64k')
          .size('720x?');
        break;
      case 'high':
        command = command
          .videoBitrate('2000k')
          .audioBitrate('192k')
          .size('1920x?');
        break;
      default: // medium
        command = command
          .videoBitrate('1000k')
          .audioBitrate('128k')
          .size('1280x?');
    }

    // Add video codec settings
    command = command
      .videoCodec('libx264')
      .audioCodec('aac')
      .format(format);

    // Add fade effects if requested
    if (includeFades) {
      const fadeInDuration = Math.min(1, duration / 4); // Max 1 second or 1/4 of clip
      const fadeOutStart = Math.max(0, duration - fadeInDuration);
      
      command = command.videoFilters([
        `fade=in:0:${Math.round(fadeInDuration * 30)}`, // 30 fps assumption
        `fade=out:${Math.round(fadeOutStart * 30)}:${Math.round(fadeInDuration * 30)}`
      ]);
    }

    command
      .on('start', (commandLine) => {
        logger.debug(`FFmpeg command: ${commandLine}`);
      })
      .on('progress', (progress) => {
        logger.debug(`Processing: ${Math.round(progress.percent || 0)}% done`);
      })
      .on('end', () => {
        logger.info(`Clip extraction completed: ${outputPath}`);
        
        // Get file stats
        const stats = fs.statSync(outputPath);
        
        resolve({
          filePath: outputPath,
          fileSize: stats.size,
          duration: duration
        });
      })
      .on('error', (error) => {
        logger.error(`FFmpeg error: ${error.message}`);
        reject(error);
      });

    command.run();
  });
};

/**
 * Generate clips from timestamps
 */
const generateClipsFromTimestamps = async (options) => {
  const {
    sourceVideoUrl,
    timestamps,
    quality = 'medium',
    format = 'mp4',
    overwrite = false,
    userId,
    projectId
  } = options;

  ensureTempDir();

  let tempVideoPath = null;
  const generatedClips = [];
  let successCount = 0;
  let failureCount = 0;

  try {
    // Download video if it's a URL
    if (sourceVideoUrl.startsWith('http')) {
      tempVideoPath = await downloadVideo(sourceVideoUrl);
    } else {
      tempVideoPath = sourceVideoUrl;
    }

    // Process each timestamp
    for (const timestamp of timestamps) {
      try {
        logger.info(`Generating clip: ${timestamp.id} - ${timestamp.title}`);

        const outputFileName = `${timestamp.id}_${uuidv4()}.${format}`;
        const tempOutputPath = path.join(TEMP_DIR, outputFileName);

        // Extract clip
        const clipResult = await extractClip({
          sourceVideoPath: tempVideoPath,
          startTime: timestamp.startTime,
          endTime: timestamp.endTime,
          outputPath: tempOutputPath,
          quality,
          format,
          includeFades: options.includeFades || false
        });

        // Upload to S3
        const videoBuffer = fs.readFileSync(tempOutputPath);
        const uploadResult = await awsService.uploadGeneratedClip(
          videoBuffer,
          outputFileName,
          userId,
          projectId
        );

        // Clean up temp file
        fs.unlinkSync(tempOutputPath);

        const generatedClip = {
          clipId: timestamp.id,
          title: timestamp.title,
          description: timestamp.description || '',
          transcript: timestamp.description || '', // Use description as transcript
          startTime: timestamp.startTime,
          endTime: timestamp.endTime,
          duration: clipResult.duration,
          hashtags: [],
          videoUrl: uploadResult.url,
          clipUrl: uploadResult.url,
          fileSize: uploadResult.size,
          processingStatus: 'completed',
          generatedAt: new Date(),
          metadata: {
            quality,
            format,
            s3Key: uploadResult.key
          }
        };

        generatedClips.push(generatedClip);
        successCount++;

        logger.info(`Successfully generated clip: ${timestamp.id}`);

      } catch (error) {
        logger.error(`Failed to generate clip ${timestamp.id}:`, error);

        // Add failed clip entry
        const failedClip = {
          clipId: timestamp.id,
          title: timestamp.title,
          description: timestamp.description || '',
          transcript: '',
          startTime: timestamp.startTime,
          endTime: timestamp.endTime,
          duration: timestamp.endTime - timestamp.startTime,
          hashtags: [],
          videoUrl: '',
          clipUrl: '',
          fileSize: 0,
          processingStatus: 'failed',
          processingError: error.message,
          generatedAt: new Date(),
          metadata: {
            error: error.message
          }
        };

        generatedClips.push(failedClip);
        failureCount++;
      }
    }

    return {
      clips: generatedClips,
      successCount,
      failureCount,
      totalRequested: timestamps.length
    };

  } catch (error) {
    logger.error('Error in clip generation process:', error);
    throw error;
  } finally {
    // Clean up downloaded video file
    if (tempVideoPath && sourceVideoUrl.startsWith('http')) {
      try {
        fs.unlinkSync(tempVideoPath);
        logger.info(`Cleaned up temp video file: ${tempVideoPath}`);
      } catch (cleanupError) {
        logger.warn(`Failed to clean up temp file: ${cleanupError.message}`);
      }
    }
  }
};

/**
 * Get video metadata using ffprobe
 */
const getVideoMetadata = async (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (error, metadata) => {
      if (error) {
        logger.error('Error getting video metadata:', error);
        reject(error);
      } else {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        resolve({
          duration: parseFloat(metadata.format.duration),
          size: parseInt(metadata.format.size),
          bitrate: parseInt(metadata.format.bit_rate),
          format: metadata.format.format_name,
          video: videoStream ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: eval(videoStream.r_frame_rate), // Convert fraction to decimal
            bitrate: parseInt(videoStream.bit_rate)
          } : null,
          audio: audioStream ? {
            codec: audioStream.codec_name,
            sampleRate: parseInt(audioStream.sample_rate),
            channels: audioStream.channels,
            bitrate: parseInt(audioStream.bit_rate)
          } : null
        });
      }
    });
  });
};

/**
 * Validate video file
 */
const validateVideo = async (videoPath) => {
  try {
    const metadata = await getVideoMetadata(videoPath);
    
    // Basic validation
    if (!metadata.video) {
      throw new Error('No video stream found');
    }
    
    if (metadata.duration < 1) {
      throw new Error('Video duration too short (minimum 1 second)');
    }
    
    if (metadata.duration > 10800) { // 3 hours
      throw new Error('Video duration too long (maximum 3 hours)');
    }

    return {
      isValid: true,
      metadata
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
};

/**
 * Clean up temp files older than 1 hour
 */
const cleanupTempFiles = () => {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;

    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > oneHour) {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up old temp file: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Error cleaning up temp files:', error);
  }
};

// Schedule periodic cleanup
setInterval(cleanupTempFiles, 30 * 60 * 1000); // Every 30 minutes

module.exports = {
  generateClipsFromTimestamps,
  extractClip,
  getVideoMetadata,
  validateVideo,
  downloadVideo,
  cleanupTempFiles
};
