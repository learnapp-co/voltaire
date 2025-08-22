import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface FileUploadResult {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

export interface GoogleDriveFileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  webViewLink?: string;
  downloadUrl?: string;
}

export interface SignedUrlConfig {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: 'video' | 'audio' | 'document' | 'image' | 'other';
  userId: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  metadata?: Record<string, any>;
}

export interface SignedUrlResult {
  signedUrl?: string;
  fileId: string;
  fileUrl: string;
  readUrl: string;
  expiresIn: number;
  method: string;
  headers?: Record<string, string>;
  maxFileSize: number;
  createdAt: Date;
  // Chunked upload fields
  isChunkedUpload: boolean;
  sessionId?: string;
  uploadId?: string;
  totalChunks?: number;
  chunkSize?: number;
  chunkUrls?: Array<{
    chunkNumber: number;
    signedUrl: string;
    expiresIn: number;
    expectedSize: number;
  }>;
}

export interface MultipartUploadConfig {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: 'video' | 'audio' | 'document' | 'image' | 'other';
  userId: string;
  chunkSize: number;
  totalChunks: number;
  expiresIn?: number;
  metadata?: Record<string, any>;
}

export interface MultipartUploadResult {
  uploadId: string;
  bucket: string;
  key: string;
  sessionId: string;
  chunkUrls: Array<{
    chunkNumber: number;
    signedUrl: string;
    expiresIn: number;
    expectedSize: number;
  }>;
}

export interface ChunkPart {
  PartNumber: number;
  ETag: string;
  Size?: number;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadPath: string;
  private drive: any;
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    // Set up upload directory
    this.uploadPath =
      this.configService.get<string>('UPLOAD_PATH') || './uploads';
    this.ensureUploadDirectory();

    // Initialize services
    this.initializeServices();
  }

  /**
   * Initialize all services
   */
  private async initializeServices(): Promise<void> {
    // Initialize AWS S3
    await this.initializeAWS();

    // Initialize Google Drive API
    this.initializeGoogleDrive();
  }

  /**
   * Ensure upload directory exists
   */
  private ensureUploadDirectory(): void {
    const srtDir = path.join(this.uploadPath, 'srt');
    const videosDir = path.join(this.uploadPath, 'videos');
    const tempDir = path.join(this.uploadPath, 'temp');

    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
    if (!fs.existsSync(srtDir)) {
      fs.mkdirSync(srtDir, { recursive: true });
    }
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  }

  /**
   * Initialize AWS S3
   */
  private async initializeAWS(): Promise<void> {
    const awsRegion =
      this.configService.get<string>('AWS_REGION') || 'us-east-1';

    // Check if using cross-account role assumption
    const devAccountRoleArn =
      this.configService.get<string>('AWS_DEV_ROLE_ARN');

    if (devAccountRoleArn) {
      // Cross-account role assumption
      const rootAccessKeyId = this.configService.get<string>(
        'AWS_ROOT_ACCESS_KEY_ID',
      );
      const rootSecretAccessKey = this.configService.get<string>(
        'AWS_ROOT_SECRET_ACCESS_KEY',
      );

      if (!rootAccessKeyId || !rootSecretAccessKey) {
        throw new Error('AWS root account credentials not configured');
      }

      const stsClient = new STSClient({
        region: awsRegion,
        credentials: {
          accessKeyId: rootAccessKeyId,
          secretAccessKey: rootSecretAccessKey,
        },
      });

      try {
        const assumeRoleCommand = new AssumeRoleCommand({
          RoleArn: devAccountRoleArn,
          RoleSessionName: 'clipflow-file-upload',
          DurationSeconds: 3600, // 1 hour
        });

        const assumeRoleResult = await stsClient.send(assumeRoleCommand);

        this.s3Client = new S3Client({
          region: awsRegion,
          credentials: {
            accessKeyId: assumeRoleResult.Credentials.AccessKeyId,
            secretAccessKey: assumeRoleResult.Credentials.SecretAccessKey,
            sessionToken: assumeRoleResult.Credentials.SessionToken,
          },
        });

        this.logger.log(
          'AWS S3 initialized with cross-account role assumption',
        );
      } catch (error) {
        this.logger.error('Failed to assume dev account role:', error);
        throw new Error('Failed to assume dev account role');
      }
    } else {
      // Direct credentials
      const awsAccessKeyId = this.configService.get<string>(
        'AWS_ROOT_ACCESS_KEY_ID',
      );
      const awsSecretAccessKey = this.configService.get<string>(
        'AWS_ROOT_SECRET_ACCESS_KEY',
      );
      const awsRegion = this.configService.get<string>('AWS_REGION');

      if (!awsAccessKeyId || !awsSecretAccessKey) {
        this.logger.warn(
          'AWS credentials not configured. File upload will use local storage only.',
        );
        return;
      }

      this.s3Client = new S3Client({
        region: awsRegion,
        credentials: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
        },
      });

      this.logger.log('AWS S3 initialized with direct credentials');
    }
  }

  /**
   * Initialize Google Drive API
   */
  private initializeGoogleDrive(): void {
    try {
      const serviceAccountKey = this.configService.get<string>(
        'GOOGLE_SERVICE_ACCOUNT_KEY',
      );
      const clientEmail = this.configService.get<string>('GOOGLE_CLIENT_EMAIL');
      const privateKey = this.configService
        .get<string>('GOOGLE_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n');

      if (serviceAccountKey) {
        // Option 1: Using service account key file
        const serviceAccount = JSON.parse(serviceAccountKey);
        const auth = new google.auth.GoogleAuth({
          credentials: serviceAccount,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        this.drive = google.drive({ version: 'v3', auth });
      } else if (clientEmail && privateKey) {
        // Option 2: Using individual credentials
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: clientEmail,
            private_key: privateKey,
          },
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        this.drive = google.drive({ version: 'v3', auth });
      } else {
        this.logger.warn(
          'Google Drive credentials not configured. Google Drive features will not be available.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize Google Drive API:', error);
    }
  }

  /**
   * Upload video file from buffer
   */
  async uploadVideoFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<FileUploadResult> {
    try {
      // Validate file type
      if (!this.isVideoFile(file)) {
        throw new BadRequestException(
          'Invalid file type. Only video files are allowed.',
        );
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${userId}_${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.uploadPath, 'videos', fileName);

      // Ensure videos directory exists
      const videosDir = path.join(this.uploadPath, 'videos');
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
      }

      // Save file
      fs.writeFileSync(filePath, file.buffer);

      // Generate URL
      const baseUrl =
        this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
      const url = `${baseUrl}/uploads/videos/${fileName}`;

      this.logger.log(`Video file uploaded successfully: ${fileName}`);

      return {
        fileName: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        url,
      };
    } catch (error) {
      this.logger.error('Error uploading video file:', error);
      throw error;
    }
  }

  /**
   * Upload SRT file from buffer
   */
  async uploadSRTFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<FileUploadResult> {
    try {
      // Validate file type
      if (!this.isSRTFile(file)) {
        throw new BadRequestException(
          'Invalid file type. Only .srt files are allowed.',
        );
      }

      // Validate SRT content
      const content = file.buffer.toString('utf-8');
      if (!this.isValidSRTContent(content)) {
        throw new BadRequestException('Invalid SRT file format.');
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${userId}_${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.uploadPath, 'srt', fileName);

      // Save file
      fs.writeFileSync(filePath, file.buffer);

      // Generate URL (this would be your server's base URL + file path)
      const baseUrl =
        this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
      const url = `${baseUrl}/uploads/srt/${fileName}`;

      this.logger.log(`SRT file uploaded successfully: ${fileName}`);

      return {
        fileName: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        url,
      };
    } catch (error) {
      this.logger.error('Error uploading SRT file:', error);
      throw error;
    }
  }

  /**
   * Upload SRT content as string
   */
  async uploadSRTContent(
    srtContent: string,
    fileName: string,
    userId: string,
  ): Promise<FileUploadResult> {
    try {
      // Validate SRT content
      if (!this.isValidSRTContent(srtContent)) {
        throw new BadRequestException('Invalid SRT content format.');
      }

      // Generate unique filename
      const fileExtension = fileName.endsWith('.srt') ? '' : '.srt';
      const uniqueFileName = `${userId}_${uuidv4()}_${fileName}${fileExtension}`;
      const filePath = path.join(this.uploadPath, 'srt', uniqueFileName);

      // Save file
      fs.writeFileSync(filePath, srtContent, 'utf-8');

      // Generate URL
      const baseUrl =
        this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
      const url = `${baseUrl}/uploads/srt/${uniqueFileName}`;

      this.logger.log(`SRT content saved successfully: ${uniqueFileName}`);

      return {
        fileName,
        filePath,
        fileSize: Buffer.byteLength(srtContent, 'utf-8'),
        mimeType: 'text/plain',
        url,
      };
    } catch (error) {
      this.logger.error('Error saving SRT content:', error);
      throw error;
    }
  }

  /**
   * Extract Google Drive file ID from URL
   */
  extractGoogleDriveFileId(url: string): string | null {
    try {
      // Handle different Google Drive URL formats
      const patterns = [
        /\/file\/d\/([a-zA-Z0-9-_]+)/, // https://drive.google.com/file/d/FILE_ID/view
        /id=([a-zA-Z0-9-_]+)/, // https://drive.google.com/open?id=FILE_ID
        /\/d\/([a-zA-Z0-9-_]+)/, // https://docs.google.com/document/d/FILE_ID/edit
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return match[1];
        }
      }

      // If URL looks like a direct file ID
      if (/^[a-zA-Z0-9-_]{25,}$/.test(url)) {
        return url;
      }

      return null;
    } catch (error) {
      this.logger.error('Error extracting Google Drive file ID:', error);
      return null;
    }
  }

  /**
   * Get Google Drive file information
   */
  async getGoogleDriveFileInfo(
    fileId: string,
  ): Promise<GoogleDriveFileInfo | null> {
    if (!this.drive) {
      throw new Error('Google Drive API is not configured');
    }

    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,size,mimeType,webViewLink',
      });

      const file = response.data;

      return {
        id: file.id,
        name: file.name,
        size: parseInt(file.size || '0', 10),
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
      };
    } catch (error) {
      this.logger.error(
        `Error getting Google Drive file info for ${fileId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Validate Google Drive file accessibility
   */
  async validateGoogleDriveFile(url: string): Promise<{
    isValid: boolean;
    fileInfo?: GoogleDriveFileInfo;
    error?: string;
  }> {
    try {
      const fileId = this.extractGoogleDriveFileId(url);
      if (!fileId) {
        return { isValid: false, error: 'Invalid Google Drive URL format' };
      }

      const fileInfo = await this.getGoogleDriveFileInfo(fileId);
      if (!fileInfo) {
        return { isValid: false, error: 'File not found or not accessible' };
      }

      // Check if it's a video file
      if (!fileInfo.mimeType.startsWith('video/')) {
        return { isValid: false, error: 'File is not a video format' };
      }

      return { isValid: true, fileInfo };
    } catch (error) {
      return { isValid: false, error: 'Failed to validate Google Drive file' };
    }
  }

  /**
   * Check if file is video format
   */
  private isVideoFile(file: Express.Multer.File): boolean {
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.wmv'];
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime', // .mov
      'video/x-msvideo', // .avi
      'video/x-matroska', // .mkv
      'video/x-ms-wmv', // .wmv
    ];

    const fileExtension = path.extname(file.originalname).toLowerCase();

    return (
      allowedExtensions.includes(fileExtension) ||
      allowedMimeTypes.includes(file.mimetype)
    );
  }

  /**
   * Check if file is SRT format
   */
  private isSRTFile(file: Express.Multer.File): boolean {
    const allowedExtensions = ['.srt'];
    const allowedMimeTypes = ['text/plain', 'application/x-subrip'];

    const fileExtension = path.extname(file.originalname).toLowerCase();

    return (
      allowedExtensions.includes(fileExtension) ||
      allowedMimeTypes.includes(file.mimetype)
    );
  }

  /**
   * Validate SRT content format
   */
  private isValidSRTContent(content: string): boolean {
    try {
      // Basic SRT format validation
      const lines = content.trim().split('\n');
      if (lines.length < 4) return false;

      // Check for subtitle index (should start with 1)
      const firstLine = lines[0].trim();
      if (!/^\d+$/.test(firstLine)) return false;

      // Check for timestamp format
      const secondLine = lines[1].trim();
      const timeRegex = /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/;
      if (!timeRegex.test(secondLine)) return false;

      // Check for subtitle text
      if (lines[2].trim().length === 0) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Read SRT file content
   */
  async readSRTFile(filePath: string): Promise<string> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('SRT file not found');
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return content;
    } catch (error) {
      this.logger.error('Error reading SRT file:', error);
      throw error;
    }
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`File deleted: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}:`, error);
    }
  }

  /**
   * Get file size in readable format
   */
  formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Generate signed URL for file upload to AWS S3 (supports both single and chunked uploads)
   */
  async generateSignedUrl(
    config: SignedUrlConfig,
    enableChunkedUpload?: boolean,
    chunkSize?: number,
  ): Promise<SignedUrlResult> {
    try {
      // Validate file type and size
      this.validateUploadConfig(config);

      // Determine if we should use chunked upload
      const shouldUseChunkedUpload = this.shouldUseChunkedUpload(
        config.fileSize,
        enableChunkedUpload,
      );

      if (shouldUseChunkedUpload) {
        // Use chunked upload for large files
        const calculatedChunkSize =
          chunkSize || this.getOptimalChunkSize(config.fileSize);

        return this.generateMultipartSignedUrl(
          config.fileName,
          config.fileSize,
          config.mimeType,
          config.fileType,
          calculatedChunkSize,
          config.metadata,
        );
      } else {
        // Use single upload for smaller files
        return this.generateS3SignedUrl(config);
      }
    } catch (error) {
      this.logger.error('Error generating signed URL:', error);
      throw new BadRequestException(
        `Failed to generate signed URL: ${error.message}`,
      );
    }
  }

  /**
   * Generate S3 signed URL for single upload
   */
  private async generateS3SignedUrl(
    config: SignedUrlConfig,
  ): Promise<SignedUrlResult> {
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      throw new Error('AWS S3 bucket not configured');
    }

    const key = `uploads/${config.userId}/${config.fileType}s/${config.fileId}`;
    const expiresIn = config.expiresIn || 3600; // 1 hour default

    // Generate PUT signed URL for upload
    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: config.mimeType,
      ContentLength: config.fileSize,
    });

    const signedUrl = await getSignedUrl(this.s3Client, putCommand, {
      expiresIn,
    });

    // Generate GET signed URL for reading
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const readUrl = await getSignedUrl(this.s3Client, getCommand);

    const fileUrl = `https://${bucket}.s3.amazonaws.com/${key}`;

    return {
      signedUrl,
      fileId: config.fileId,
      fileUrl,
      readUrl,
      expiresIn,
      method: 'PUT',
      headers: {
        'Content-Type': config.mimeType,
        'Content-Length': config.fileSize.toString(),
      },
      maxFileSize: config.fileSize,
      createdAt: new Date(),
      isChunkedUpload: false,
    };
  }

  /**
   * Generate multipart upload signed URLs
   */
  private async generateMultipartSignedUrl(
    fileName: string,
    fileSize: number,
    mimeType: string,
    fileType: string,
    chunkSize: number,
    metadata?: Record<string, any>,
  ): Promise<SignedUrlResult> {
    try {
      const bucket = this.configService.get<string>('AWS_S3_BUCKET');
      if (!bucket) {
        throw new Error('AWS S3 bucket not configured');
      }

      const key = `uploads/${uuidv4()}/${fileType}s/${uuidv4()}`; // Generate a unique key for each upload
      const expiresIn = 3600; // 1 hour default

      // Calculate optimal chunk size and total chunks
      const { optimalChunkSize, totalChunks } = this.calculateChunkParameters(
        fileSize,
        chunkSize,
      );

      // Initiate multipart upload
      const multipartUpload = await this.s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          Metadata: metadata,
          ContentType: mimeType,
        }),
      );

      const uploadId = multipartUpload.UploadId;
      if (!uploadId) {
        throw new Error('Failed to get upload ID from AWS S3');
      }

      // Generate signed URLs for each chunk
      const chunkUrls: Array<{
        chunkNumber: number;
        signedUrl: string;
        expiresIn: number;
        expectedSize: number;
      }> = [];
      for (let i = 1; i <= totalChunks; i++) {
        const startByte = (i - 1) * optimalChunkSize;
        const endByte = Math.min(
          startByte + optimalChunkSize - 1,
          fileSize - 1,
        );

        // Create upload part command
        const uploadPartCommand = new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: i,
          Body: '', // This will be provided by the client
        });

        // Generate signed URL for this chunk
        const signedUrl = await getSignedUrl(this.s3Client, uploadPartCommand, {
          expiresIn,
        });

        chunkUrls.push({
          chunkNumber: i,
          signedUrl,
          expiresIn,
          expectedSize: endByte - startByte + 1,
        });
      }

      // Generate GET signed URL for reading (will be available after completion)
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const readUrl = await getSignedUrl(this.s3Client, getCommand);
      const fileUrl = `https://${bucket}.s3.amazonaws.com/${key}`;

      return {
        signedUrl: '', // Not used for chunked uploads
        fileId: uuidv4(), // Generate a unique fileId for chunked uploads
        fileUrl,
        readUrl,
        expiresIn,
        method: 'PUT',
        maxFileSize: fileSize,
        createdAt: new Date(),
        isChunkedUpload: true,
        sessionId: `session_${uuidv4()}`,
        uploadId,
        totalChunks,
        chunkSize: optimalChunkSize,
        chunkUrls, // Return signed URLs for each chunk
      };
    } catch (error) {
      this.logger.error('Error generating multipart signed URLs:', error);
      throw new Error(
        `Failed to generate multipart signed URLs: ${error.message}`,
      );
    }
  }

  /**
   * Generate signed URLs for all chunks
   */
  private async generateChunkSignedUrls(
    bucket: string,
    key: string,
    uploadId: string,
    totalChunks: number,
    chunkSize: number,
    totalFileSize: number,
    expiresIn: number,
  ): Promise<
    Array<{
      chunkNumber: number;
      signedUrl: string;
      expiresIn: number;
      expectedSize: number;
    }>
  > {
    const chunkUrls = [];

    for (let i = 1; i <= totalChunks; i++) {
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: i,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      // Calculate expected size for this chunk
      const isLastChunk = i === totalChunks;
      const expectedSize = isLastChunk
        ? totalFileSize - (i - 1) * chunkSize
        : chunkSize;

      chunkUrls.push({
        chunkNumber: i,
        signedUrl,
        expiresIn,
        expectedSize,
      });
    }

    return chunkUrls;
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: ChunkPart[],
  ): Promise<string> {
    this.logger.log(
      `Attempting AWS S3 multipart upload completion with ${parts.length} parts`,
    );
    this.logger.log(`Parts eTags: ${parts.map((p) => p.ETag).join(', ')}`);

    try {
      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            PartNumber: part.PartNumber,
            ETag: part.ETag,
          })),
        },
      });

      const result = await this.s3Client.send(command);
      const finalUrl =
        result.Location || `https://${bucket}.s3.amazonaws.com/${key}`;
      this.logger.log(
        `✅ AWS S3 multipart upload completed successfully: ${finalUrl}`,
      );
      return finalUrl;
    } catch (error) {
      this.logger.error('Error completing multipart upload:', error);

      if (
        error.name === 'NoSuchUpload' ||
        error.message?.includes('NoSuchUpload')
      ) {
        this.logger.error(
          '🚨 AWS S3 multipart upload session expired or not found',
        );
        this.logger.error(
          'This might be due to timing - the multipart upload session expired before completion',
        );
        this.logger.error(
          'The chunks were uploaded to AWS S3 but the upload was not completed in time',
        );

        throw new Error(
          `AWS multipart upload session expired. Upload ID: ${uploadId}. Chunks were uploaded but session timed out before completion.`,
        );
      }

      throw new Error(`Failed to complete multipart upload: ${error.message}`);
    }
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
  ): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      });

      await this.s3Client.send(command);
      this.logger.log(`Aborted multipart upload: ${uploadId}`);
    } catch (error) {
      this.logger.error('Error aborting multipart upload:', error);
      throw new Error(`Failed to abort multipart upload: ${error.message}`);
    }
  }

  /**
   * List uploaded parts for a multipart upload
   */
  async listMultipartUploadParts(
    bucket: string,
    key: string,
    uploadId: string,
  ): Promise<Array<{ PartNumber: number; ETag: string; Size: number }>> {
    try {
      const command = new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      });

      const result = await this.s3Client.send(command);
      return (
        result.Parts?.map((part) => ({
          PartNumber: part.PartNumber!,
          ETag: part.ETag!,
          Size: part.Size!,
        })) || []
      );
    } catch (error) {
      this.logger.error('Error listing multipart upload parts:', error);
      throw new Error(
        `Failed to list multipart upload parts: ${error.message}`,
      );
    }
  }

  /**
   * Determine if chunked upload should be used
   */
  private shouldUseChunkedUpload(
    fileSize: number,
    enableChunkedUpload?: boolean,
  ): boolean {
    // If explicitly enabled/disabled, respect that choice
    if (enableChunkedUpload !== undefined) {
      return enableChunkedUpload;
    }

    // Auto-decide based on file size
    const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100MB
    return fileSize > CHUNKED_UPLOAD_THRESHOLD;
  }

  /**
   * Calculate optimal chunk size based on file size
   */
  private getOptimalChunkSize(fileSize: number): number {
    const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB (S3 minimum)
    const MAX_CHUNK_SIZE = 100 * 1024 * 1024; // 100MB
    const TARGET_CHUNKS = 100; // Aim for around 100 chunks max

    let chunkSize = Math.ceil(fileSize / TARGET_CHUNKS);

    // Ensure chunk size is within S3 limits
    chunkSize = Math.max(chunkSize, MIN_CHUNK_SIZE);
    chunkSize = Math.min(chunkSize, MAX_CHUNK_SIZE);

    // Round to nearest MB for cleaner chunks
    return Math.ceil(chunkSize / (1024 * 1024)) * 1024 * 1024;
  }

  /**
   * Validate upload configuration
   */
  private validateUploadConfig(config: SignedUrlConfig): void {
    const maxFileSize = this.getMaxFileSize(config.fileType);

    if (config.fileSize > maxFileSize) {
      throw new BadRequestException(
        `File size ${this.formatFileSize(config.fileSize)} exceeds maximum allowed size ${this.formatFileSize(maxFileSize)} for ${config.fileType} files`,
      );
    }

    // Validate file type based on MIME type
    if (!this.isValidMimeType(config.mimeType, config.fileType)) {
      throw new BadRequestException(
        `MIME type ${config.mimeType} is not allowed for ${config.fileType} files`,
      );
    }
  }

  /**
   * Get maximum file size for file type
   */
  private getMaxFileSize(fileType: string): number {
    const maxSizes = {
      video: 20 * 1024 * 1024 * 1024, // 20GB
      audio: 500 * 1024 * 1024, // 500MB
      image: 50 * 1024 * 1024, // 50MB
      document: 100 * 1024 * 1024, // 100MB
      other: 100 * 1024 * 1024, // 100MB
    };

    return maxSizes[fileType] || maxSizes.other;
  }

  /**
   * Validate MIME type for file type
   */
  private isValidMimeType(mimeType: string, fileType: string): boolean {
    const allowedMimeTypes = {
      video: [
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
        'video/x-ms-wmv',
      ],
      audio: [
        'audio/mpeg',
        'audio/wav',
        'audio/mp3',
        'audio/mp4',
        'audio/x-m4a',
      ],
      image: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ],
      document: [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      other: [], // Allow any MIME type for other
    };

    const allowed = allowedMimeTypes[fileType];
    if (!allowed || allowed.length === 0) {
      return true; // Allow any MIME type for 'other' or unspecified types
    }

    return allowed.includes(mimeType);
  }

  /**
   * Generate unique file ID
   */
  generateFileId(userId: string, fileName: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0]; // Use first part of UUID for brevity
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${userId}_${timestamp}_${uuid}_${cleanFileName}`;
  }

  /**
   * Clean up old temporary files
   */
  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const tempDir = path.join(this.uploadPath, 'temp');
      const files = fs.readdirSync(tempDir);
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        const age = Date.now() - stats.mtime.getTime();

        if (age > maxAge) {
          await this.deleteFile(filePath);
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up old files:', error);
    }
  }

  /**
   * Calculate optimal chunk size and total chunks
   */
  private calculateChunkParameters(
    fileSize: number,
    requestedChunkSize?: number,
  ): { optimalChunkSize: number; totalChunks: number } {
    const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB (S3 minimum)
    const MAX_CHUNK_SIZE = 100 * 1024 * 1024; // 100MB
    const TARGET_CHUNKS = 100; // Aim for around 100 chunks max

    let optimalChunkSize =
      requestedChunkSize || Math.ceil(fileSize / TARGET_CHUNKS);

    // Ensure chunk size is within S3 limits
    optimalChunkSize = Math.max(optimalChunkSize, MIN_CHUNK_SIZE);
    optimalChunkSize = Math.min(optimalChunkSize, MAX_CHUNK_SIZE);

    // Round to nearest MB for cleaner chunks
    optimalChunkSize =
      Math.ceil(optimalChunkSize / (1024 * 1024)) * 1024 * 1024;

    const totalChunks = Math.ceil(fileSize / optimalChunkSize);

    return { optimalChunkSize, totalChunks };
  }
}
