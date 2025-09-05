import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

export interface SignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface SignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  fileName: string;
  expiresIn: number;
}

export interface InitiateMultipartUploadRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface InitiateMultipartUploadResponse {
  uploadId: string;
  fileKey: string;
  fileUrl: string;
  chunkSize: number;
  totalChunks: number;
  expiresIn: number;
}

export interface ChunkUploadUrlRequest {
  uploadId: string;
  fileKey: string;
  partNumber: number;
}

export interface ChunkUploadUrlResponse {
  uploadUrl: string;
  partNumber: number;
  expiresIn: number;
}

export interface CompleteMultipartUploadRequest {
  uploadId: string;
  fileKey: string;
  parts: Array<{
    partNumber: number;
    etag: string;
  }>;
}

export interface CompleteMultipartUploadResponse {
  fileUrl: string;
  fileKey: string;
}

@Injectable()
export class S3UploadService {
  private readonly logger = new Logger(S3UploadService.name);
  private s3Client: S3Client;
  private stsClient: STSClient;
  private bucketName: string;
  private subAccountRoleArn?: string;
  private assumedRoleCredentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration?: Date;
  };

  constructor(private readonly configService: ConfigService) {
    this.initializeS3();
  }

  private async initializeS3(): Promise<void> {
    try {
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
      );
      const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
      this.bucketName = this.configService.get<string>('AWS_S3_BUCKET');
      this.subAccountRoleArn = this.configService.get<string>(
        'AWS_SUB_ACCOUNT_ROLE_ARN',
      );

      if (!accessKeyId || !secretAccessKey || !this.bucketName) {
        throw new Error('Missing required AWS S3 configuration');
      }

      // Initialize STS client for AssumeRole (if needed)
      this.stsClient = new STSClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // If sub-account role is configured, assume role to get credentials
      if (this.subAccountRoleArn) {
        this.logger.log(`Using sub-account role: ${this.subAccountRoleArn}`);
        await this.assumeSubAccountRole();
      } else {
        // Use direct credentials
        this.s3Client = new S3Client({
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
      }

      this.logger.log('S3 client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize S3 client:', error);
      throw error;
    }
  }

  /**
   * Assume role in sub-account to get temporary credentials
   */
  private async assumeSubAccountRole(): Promise<void> {
    try {
      const sessionName = `clipflow-session-${Date.now()}`;
      const command = new AssumeRoleCommand({
        RoleArn: this.subAccountRoleArn,
        RoleSessionName: sessionName,
        DurationSeconds: 3600, // 1 hour
      });

      const response = await this.stsClient.send(command);

      if (!response.Credentials) {
        throw new Error('Failed to get credentials from AssumeRole');
      }

      this.assumedRoleCredentials = {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!,
        expiration: response.Credentials.Expiration,
      };

      // Create S3 client with assumed role credentials
      const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: this.assumedRoleCredentials.accessKeyId,
          secretAccessKey: this.assumedRoleCredentials.secretAccessKey,
          sessionToken: this.assumedRoleCredentials.sessionToken,
        },
      });

      this.logger.log(`Successfully assumed role: ${this.subAccountRoleArn}`);
    } catch (error) {
      this.logger.error('Failed to assume sub-account role:', error);
      throw new BadRequestException(
        `Failed to assume sub-account role: ${error.message}`,
      );
    }
  }

  /**
   * Check if credentials need to be refreshed and refresh if necessary
   */
  private async ensureValidCredentials(): Promise<void> {
    if (!this.subAccountRoleArn || !this.assumedRoleCredentials) {
      return; // Not using sub-account role
    }

    const now = new Date();
    const expiration = this.assumedRoleCredentials.expiration;

    // Refresh credentials if they expire within 5 minutes
    if (expiration && expiration.getTime() - now.getTime() < 5 * 60 * 1000) {
      this.logger.log('Refreshing assumed role credentials');
      await this.assumeSubAccountRole();
    }
  }

  /**
   * Generate signed URL for client-side S3 upload (single upload)
   */
  async generateSignedUrl(
    request: SignedUrlRequest,
  ): Promise<SignedUrlResponse> {
    try {
      // Ensure credentials are valid (refresh if needed)
      await this.ensureValidCredentials();

      // Generate unique file name to avoid conflicts
      const fileExtension = request.fileName.split('.').pop();
      const uniqueFileName = `videos/${uuidv4()}.${fileExtension}`;

      // Validate file type
      this.validateVideoFile(request.fileName, request.fileType);

      // Validate file size (max 2GB)
      if (request.fileSize > 2 * 1024 * 1024 * 1024) {
        throw new BadRequestException('File size exceeds 2GB limit');
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueFileName,
        ContentType: request.fileType,
        ContentLength: request.fileSize,
        ACL: 'public-read', // Make uploaded files publicly accessible
      });

      const expiresIn = 3600; // 1 hour
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      // Construct the file URL (without query parameters)
      const fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${uniqueFileName}`;

      this.logger.log(`Generated signed URL for file: ${uniqueFileName}`);

      return {
        uploadUrl,
        fileUrl,
        fileName: uniqueFileName,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Failed to generate signed URL:', error);
      throw new BadRequestException(
        `Failed to generate upload URL: ${error.message}`,
      );
    }
  }

  /**
   * Initiate multipart upload for large files
   */
  async initiateMultipartUpload(
    request: InitiateMultipartUploadRequest,
  ): Promise<InitiateMultipartUploadResponse> {
    try {
      // Ensure credentials are valid (refresh if needed)
      await this.ensureValidCredentials();

      // Generate unique file name to avoid conflicts
      const fileExtension = request.fileName.split('.').pop();
      const uniqueFileName = `videos/${uuidv4()}.${fileExtension}`;

      // Validate file type
      this.validateVideoFile(request.fileName, request.fileType);

      // Validate file size (max 5GB for multipart)
      if (request.fileSize > 5 * 1024 * 1024 * 1024) {
        throw new BadRequestException('File size exceeds 5GB limit');
      }

      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: uniqueFileName,
        ContentType: request.fileType,
        ACL: 'public-read', // Make uploaded files publicly accessible
      });

      const response = await this.s3Client.send(command);

      if (!response.UploadId) {
        throw new Error('Failed to get upload ID from S3');
      }

      // Calculate chunk size and total chunks
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      const totalChunks = Math.ceil(request.fileSize / chunkSize);

      // Construct the file URL
      const fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${uniqueFileName}`;

      this.logger.log(
        `Initiated multipart upload: ${response.UploadId} for file: ${uniqueFileName}`,
      );

      return {
        uploadId: response.UploadId,
        fileKey: uniqueFileName,
        fileUrl,
        chunkSize,
        totalChunks,
        expiresIn: 3600, // URLs expire in 1 hour
      };
    } catch (error) {
      this.logger.error('Failed to initiate multipart upload:', error);
      throw new BadRequestException(
        `Failed to initiate multipart upload: ${error.message}`,
      );
    }
  }

  /**
   * Generate signed URL for uploading a specific chunk/part
   */
  async generateChunkUploadUrl(
    request: ChunkUploadUrlRequest,
  ): Promise<ChunkUploadUrlResponse> {
    try {
      // Ensure credentials are valid (refresh if needed)
      await this.ensureValidCredentials();

      const command = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: request.fileKey,
        UploadId: request.uploadId,
        PartNumber: request.partNumber,
      });

      const expiresIn = 3600; // 1 hour
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log(
        `Generated chunk upload URL for part ${request.partNumber} of upload ${request.uploadId}`,
      );

      return {
        uploadUrl,
        partNumber: request.partNumber,
        expiresIn,
      };
    } catch (error) {
      this.logger.error('Failed to generate chunk upload URL:', error);
      throw new BadRequestException(
        `Failed to generate chunk upload URL: ${error.message}`,
      );
    }
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    request: CompleteMultipartUploadRequest,
  ): Promise<CompleteMultipartUploadResponse> {
    try {
      // Ensure credentials are valid (refresh if needed)
      await this.ensureValidCredentials();

      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: request.fileKey,
        UploadId: request.uploadId,
        MultipartUpload: {
          Parts: request.parts.map((part) => ({
            ETag: part.etag,
            PartNumber: part.partNumber,
          })),
        },
      });

      await this.s3Client.send(command);

      // Construct the file URL
      const fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${request.fileKey}`;

      this.logger.log(
        `Completed multipart upload: ${request.uploadId} for file: ${request.fileKey}`,
      );

      return {
        fileUrl,
        fileKey: request.fileKey,
      };
    } catch (error) {
      this.logger.error('Failed to complete multipart upload:', error);
      throw new BadRequestException(
        `Failed to complete multipart upload: ${error.message}`,
      );
    }
  }

  /**
   * Abort multipart upload (cleanup)
   */
  async abortMultipartUpload(uploadId: string, fileKey: string): Promise<void> {
    try {
      // Ensure credentials are valid (refresh if needed)
      await this.ensureValidCredentials();

      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        UploadId: uploadId,
      });

      await this.s3Client.send(command);

      this.logger.log(
        `Aborted multipart upload: ${uploadId} for file: ${fileKey}`,
      );
    } catch (error) {
      this.logger.error('Failed to abort multipart upload:', error);
      throw new BadRequestException(
        `Failed to abort multipart upload: ${error.message}`,
      );
    }
  }

  /**
   * Validate video file type and extension
   */
  private validateVideoFile(fileName: string, mimeType: string): void {
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/webm',
    ];

    const fileExtension = fileName
      .toLowerCase()
      .substring(fileName.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`,
      );
    }

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`,
      );
    }
  }

  /**
   * Extract file name from S3 URL
   */
  extractFileNameFromS3Url(s3Url: string): string {
    try {
      const url = new URL(s3Url);
      const pathParts = url.pathname.split('/');
      return pathParts[pathParts.length - 1];
    } catch (error) {
      this.logger.warn('Failed to extract filename from S3 URL:', s3Url);
      return 'unknown-file';
    }
  }

  /**
   * Upload a local file to S3 with project organization
   * Path: clips/{projectId}/{clipId}.{format}
   */
  async uploadLocalFileToS3(
    localFilePath: string,
    projectId: string,
    clipId: string,
    format: string = 'mp4',
  ): Promise<string> {
    try {
      this.logger.log(
        `☁️ Starting S3 upload for clip ${clipId} (${projectId})`,
      );

      // Ensure credentials are valid (refresh if needed)
      await this.ensureValidCredentials();

      // Read the local file
      const fileBuffer = fs.readFileSync(localFilePath);

      // Organize clips by project: clips/projectId/clipId.format
      // Same clipId will override existing clips
      const clipKey = `clips/${projectId}/${clipId}.${format}`;

      this.logger.log(
        `📊 File details - Size: ${fileBuffer.length} bytes, S3 Key: ${clipKey}`,
      );

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: clipKey,
        Body: fileBuffer,
        ContentType: `video/${format}`,
        ACL: 'public-read', // Make uploaded files publicly accessible
        Metadata: {
          projectId,
          clipId,
          uploadedAt: new Date().toISOString(),
        },
      });

      this.logger.log(`🚀 Uploading to S3 bucket: ${this.bucketName}`);
      await this.s3Client.send(command);

      // Return the public URL
      const clipUrl = `https://${this.bucketName}.s3.amazonaws.com/${clipKey}`;

      this.logger.log(
        `✅ Successfully uploaded clip ${clipId} for project ${projectId} to S3: ${clipKey}`,
      );

      return clipUrl;
    } catch (error) {
      this.logger.error(
        `Failed to upload clip ${clipId} for project ${projectId} to S3:`,
        error,
      );
      throw new BadRequestException(
        `Failed to upload clip to S3: ${error.message}`,
      );
    }
  }

  /**
   * Generate signed URL for reading/downloading a file from S3
   */
  async generateSignedReadUrl(s3Url: string): Promise<string> {
    try {
      this.logger.log(`🔗 Generating signed read URL for S3: ${s3Url}`);

      // Ensure credentials are valid (refresh if needed)
      await this.ensureValidCredentials();

      // Extract key from S3 URL
      const fileKey = this.extractS3KeyFromUrl(s3Url);
      this.logger.log(`🔑 Extracted S3 key: ${fileKey}`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const expiresIn = 3600; // 1 hour
      this.logger.log(`⏰ Generating signed URL with ${expiresIn}s expiration`);
      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log(`✅ Generated signed read URL for: ${fileKey}`);
      return signedUrl;
    } catch (error) {
      this.logger.error('Failed to generate signed read URL:', error);
      throw new BadRequestException(
        `Failed to generate signed read URL: ${error.message}`,
      );
    }
  }

  /**
   * Extract S3 key from S3 URL
   */
  private extractS3KeyFromUrl(s3Url: string): string {
    try {
      const url = new URL(s3Url);
      // Remove leading slash from pathname
      return url.pathname.substring(1);
    } catch (error) {
      throw new Error(`Invalid S3 URL format: ${s3Url}`);
    }
  }

  /**
   * Validate S3 URL format
   */
  isValidS3Url(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('s3.amazonaws.com') ||
        urlObj.hostname.includes('.s3.') ||
        urlObj.hostname.startsWith('s3-')
      );
    } catch {
      return false;
    }
  }
}
