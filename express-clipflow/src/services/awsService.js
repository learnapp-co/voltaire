const AWS = require('aws-sdk');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const logger = require('../utils/logger');

// Configure AWS
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'clipflow-bucket';

/**
 * Configure multer for S3 uploads
 */
const createS3Upload = (fileType) => {
  return multer({
    storage: multerS3({
      s3: s3Client,
      bucket: BUCKET_NAME,
      metadata: (req, file, cb) => {
        cb(null, {
          fieldName: file.fieldname,
          uploadedBy: req.user?.id || 'anonymous',
          uploadedAt: new Date().toISOString()
        });
      },
      key: (req, file, cb) => {
        const userId = req.user?.id || 'anonymous';
        const fileExtension = path.extname(file.originalname);
        const fileName = `${userId}_${uuidv4()}${fileExtension}`;
        const filePath = `uploads/${userId}/${fileType}/${fileName}`;
        cb(null, filePath);
      }
    }),
    limits: {
      fileSize: fileType === 'videos' ? 500 * 1024 * 1024 : 10 * 1024 * 1024 // 500MB for videos, 10MB for others
    },
    fileFilter: (req, file, cb) => {
      if (fileType === 'videos') {
        const allowedTypes = /mp4|mov|avi|mkv|webm/;
        const mimeType = allowedTypes.test(file.mimetype);
        const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimeType && extName) {
          return cb(null, true);
        } else {
          cb(new Error('Only video files are allowed'));
        }
      } else if (fileType === 'srt') {
        const allowedTypes = /srt|txt/;
        const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (extName || file.mimetype === 'text/plain') {
          return cb(null, true);
        } else {
          cb(new Error('Only SRT files are allowed'));
        }
      }
      
      cb(new Error('Invalid file type'));
    }
  });
};

/**
 * Upload video file to S3
 */
const uploadVideo = async (file, userId) => {
  try {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${userId}_${uuidv4()}${fileExtension}`;
    const key = `uploads/${userId}/videos/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        originalName: file.originalname
      }
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    logger.info(`Video uploaded to S3: ${key}`);

    return {
      url,
      key,
      bucket: BUCKET_NAME,
      size: file.size,
      originalName: file.originalname,
      mimeType: file.mimetype
    };
  } catch (error) {
    logger.error('Error uploading video to S3:', error);
    throw error;
  }
};

/**
 * Upload SRT file to S3
 */
const uploadSRT = async (file, userId) => {
  try {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${userId}_${uuidv4()}${fileExtension}`;
    const key = `uploads/${userId}/srt/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: 'text/plain',
      Metadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        originalName: file.originalname
      }
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    logger.info(`SRT file uploaded to S3: ${key}`);

    return {
      url,
      key,
      bucket: BUCKET_NAME,
      size: file.size,
      originalName: file.originalname,
      content: file.buffer.toString('utf-8')
    };
  } catch (error) {
    logger.error('Error uploading SRT to S3:', error);
    throw error;
  }
};

/**
 * Upload generated clip to S3
 */
const uploadGeneratedClip = async (videoBuffer, fileName, userId, projectId) => {
  try {
    const key = `uploads/${userId}/clips/${projectId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: videoBuffer,
      ContentType: 'video/mp4',
      Metadata: {
        uploadedBy: userId,
        projectId: projectId,
        uploadedAt: new Date().toISOString(),
        type: 'generated_clip'
      }
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    logger.info(`Generated clip uploaded to S3: ${key}`);

    return {
      url,
      key,
      bucket: BUCKET_NAME,
      size: videoBuffer.length
    };
  } catch (error) {
    logger.error('Error uploading generated clip to S3:', error);
    throw error;
  }
};

/**
 * Generate signed URL for download
 */
const generateDownloadUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    logger.error('Error generating download URL:', error);
    throw error;
  }
};

/**
 * Delete file from S3
 */
const deleteFile = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    logger.info(`File deleted from S3: ${key}`);
  } catch (error) {
    logger.error('Error deleting file from S3:', error);
    throw error;
  }
};

/**
 * Delete all files associated with a clip project
 */
const deleteClipFiles = async (clip) => {
  try {
    const filesToDelete = [];

    // Extract S3 keys from URLs
    const extractKey = (url) => {
      if (!url) return null;
      try {
        const urlObj = new URL(url);
        return urlObj.pathname.slice(1); // Remove leading slash
      } catch {
        return null;
      }
    };

    // Add main files
    const rawFileKey = extractKey(clip.rawFileUrl);
    const srtFileKey = extractKey(clip.srtFileUrl);
    const awsFileKey = extractKey(clip.awsFileUrl);

    if (rawFileKey && rawFileKey.includes('s3.amazonaws.com')) filesToDelete.push(rawFileKey);
    if (srtFileKey) filesToDelete.push(srtFileKey);
    if (awsFileKey) filesToDelete.push(awsFileKey);

    // Add generated clip files
    if (clip.generatedClips) {
      clip.generatedClips.forEach(generatedClip => {
        const clipKey = extractKey(generatedClip.videoUrl || generatedClip.clipUrl);
        if (clipKey) filesToDelete.push(clipKey);
      });
    }

    // Delete all files
    const deletePromises = filesToDelete.map(key => deleteFile(key));
    await Promise.allSettled(deletePromises);

    logger.info(`Deleted ${filesToDelete.length} files for clip: ${clip._id}`);
  } catch (error) {
    logger.error('Error deleting clip files:', error);
    throw error;
  }
};

/**
 * Check if file exists in S3
 */
const fileExists = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
};

/**
 * Get file metadata from S3
 */
const getFileMetadata = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    
    return {
      size: response.ContentLength,
      lastModified: response.LastModified,
      contentType: response.ContentType,
      metadata: response.Metadata
    };
  } catch (error) {
    logger.error('Error getting file metadata:', error);
    throw error;
  }
};

module.exports = {
  createS3Upload,
  uploadVideo,
  uploadSRT,
  uploadGeneratedClip,
  generateDownloadUrl,
  deleteFile,
  deleteClipFiles,
  fileExists,
  getFileMetadata,
  s3Client,
  BUCKET_NAME
};
