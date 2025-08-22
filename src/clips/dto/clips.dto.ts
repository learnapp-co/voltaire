import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OpenAIModel, ClipStatus } from '../../schemas/clip.schema';

export class CreateClipProjectDto {
  @ApiProperty({
    description: 'Project name for the clip generation',
    example: 'Hustle_Mouni_roy_LF',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Google Drive URL for the raw video file',
    example: 'https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view',
  })
  @IsString()
  rawFileUrl: string;

  @ApiPropertyOptional({
    description: 'OpenAI model to use for analysis and generation',
    enum: OpenAIModel,
    default: OpenAIModel.GPT_4_MINI,
  })
  @IsOptional()
  @IsEnum(OpenAIModel)
  selectedModel?: OpenAIModel;
}

export class CreateClipProjectWithSrtDto {
  @ApiProperty({
    description: 'Project name for the clip generation',
    example: 'Hustle_Mouni_roy_LF',
  })
  title: string;

  @ApiPropertyOptional({
    description:
      'Google Drive URL for the raw video file (use this OR upload local file OR AWS S3 file)',
    example: 'https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view',
  })
  rawFileUrl?: string;

  @ApiPropertyOptional({
    description: 'AWS S3 file URL from chunked upload (required for video files)',
    example:
      'https://bucket.s3.amazonaws.com/uploads/user123/videos/file123.mp4',
  })
  awsFileUrl?: string;

  @ApiPropertyOptional({
    description: 'Upload session ID from chunked upload (if using AWS upload)',
    example: 'session_abc123-def456',
  })
  uploadSessionId?: string;

  @ApiPropertyOptional({
    description: 'OpenAI model to use for analysis and generation',
    enum: OpenAIModel,
    default: OpenAIModel.GPT_4_MINI,
  })
  selectedModel?: string;
}

export class UploadSrtDto {
  @ApiProperty({
    description: 'Raw SRT file content',
    example: `1
00:00:00,000 --> 00:00:05,000
Welcome to our podcast about AI in healthcare.

2
00:00:05,000 --> 00:00:10,000
Today we'll discuss the latest developments...`,
  })
  @IsString()
  srtContent: string;

  @ApiProperty({
    description: 'Original SRT filename',
    example: 'episode_123_subtitles.srt',
  })
  @IsString()
  srtFileName: string;
}

export class ThemeDto {
  @ApiProperty({
    description: 'Theme title',
    example: 'AI Diagnostic Tools',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Detailed description of the theme',
    example:
      'Discussion about AI-powered diagnostic tools and their impact on patient care',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'The angle or perspective of this theme',
    example:
      'Benefits and challenges of implementing AI diagnostics in hospitals',
  })
  @IsString()
  angle: string;

  @ApiProperty({
    description: 'Confidence score for this theme (0-1)',
    example: 0.87,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiPropertyOptional({
    description: 'Key keywords associated with this theme',
    example: ['AI', 'diagnostics', 'healthcare', 'patient care'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    description: 'Time ranges where this theme is discussed (in seconds)',
    example: [120, 300, 450, 600],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  timeRanges?: number[];
}

export class SelectThemeAndGenerateDto {
  @ApiProperty({
    description: 'Selected theme for clip generation',
    type: ThemeDto,
  })
  @ValidateNested()
  @Type(() => ThemeDto)
  @IsObject()
  selectedTheme: ThemeDto;

  @ApiProperty({
    description: 'Number of clips to generate',
    example: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsNumber()
  @Min(1)
  @Max(20)
  clipCount: number;
}

export class GeneratedClipDto {
  @ApiProperty({
    description: 'Unique clip identifier',
    example: 'clip_507f1f77bcf86cd799439011',
  })
  @IsString()
  clipId: string;

  @ApiProperty({
    description: 'Clip title',
    example: 'AI Revolutionizing Medical Diagnosis',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Clip description',
    example: 'Learn how AI is transforming the way doctors diagnose diseases',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Start time in seconds',
    example: 120,
  })
  @IsNumber()
  @Min(0)
  startTime: number;

  @ApiProperty({
    description: 'End time in seconds',
    example: 180,
  })
  @IsNumber()
  @Min(0)
  endTime: number;

  @ApiProperty({
    description: 'Duration in seconds',
    example: 60,
  })
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({
    description: 'Transcript of the clip',
    example:
      'AI diagnostic tools are revolutionizing healthcare by providing faster and more accurate diagnoses...',
  })
  @IsString()
  transcript: string;

  @ApiPropertyOptional({
    description: 'Suggested hashtags for social media',
    example: ['#AI', '#Healthcare', '#MedTech', '#Innovation'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional({
    description: 'URL to the generated video clip file',
    example:
      'http://localhost:3000/uploads/clips/project123/clip_1_AI_Revolutionizing_Medical_Diagnosis_uuid.mp4',
  })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({
    description: 'File size of the generated video clip in bytes',
    example: 15728640,
  })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Processing status of the video clip',
    example: 'completed',
    enum: ['pending', 'processing', 'completed', 'failed'],
  })
  @IsOptional()
  @IsString()
  processingStatus?: string;

  @ApiPropertyOptional({
    description: 'Error message if video processing failed',
    example: 'FFmpeg processing error: Invalid timestamp',
  })
  @IsOptional()
  @IsString()
  processingError?: string;

  @ApiPropertyOptional({
    description: 'When this clip was generated',
  })
  @IsOptional()
  generatedAt?: Date;
}

// Response DTOs
export class ClipProjectResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the clip project',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Project title',
    example: 'Podcast Episode 123 - AI in Healthcare',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Discussion about the future of AI in healthcare industry',
  })
  description?: string;

  @ApiProperty({
    description: 'Current processing status',
    enum: ClipStatus,
    example: ClipStatus.PENDING,
  })
  status: ClipStatus;

  @ApiProperty({
    description: 'Selected OpenAI model',
    enum: OpenAIModel,
    example: OpenAIModel.GPT_4_MINI,
  })
  selectedModel: OpenAIModel;

  @ApiProperty({
    description: 'Raw video file information',
    example: {
      url: 'https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view',
      fileName: 'podcast_episode_123.mp4',
      fileSize: 1073741824,
    },
  })
  rawFile: {
    url: string;
    fileName: string;
    fileSize: number;
  };

  @ApiPropertyOptional({
    description: 'SRT file information (if uploaded)',
    example: {
      fileName: 'episode_123_subtitles.srt',
      url: '/uploads/srt/episode_123_subtitles.srt',
    },
  })
  srtFile?: {
    fileName: string;
    url: string;
  };

  @ApiPropertyOptional({
    description: 'Total video duration in seconds',
    example: 3600,
  })
  totalDuration?: number;

  @ApiPropertyOptional({
    description: 'Error message if processing failed',
    example: 'Failed to analyze SRT content: Invalid format',
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Project creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Project last update timestamp',
  })
  updatedAt: Date;
}

export class ThemeAnalysisResponseDto {
  @ApiProperty({
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Current status',
    enum: ClipStatus,
    example: ClipStatus.READY_FOR_GENERATION,
  })
  status: ClipStatus;

  @ApiProperty({
    description: 'Analyzed themes from the video content',
    type: [ThemeDto],
  })
  analyzedThemes: ThemeDto[];

  @ApiProperty({
    description: 'Total video duration in seconds',
    example: 3600,
  })
  totalDuration: number;

  @ApiProperty({
    description: 'Total tokens used for analysis',
    example: 2500,
  })
  totalTokensUsed: number;

  @ApiProperty({
    description: 'Estimated cost for the analysis in USD',
    example: 0.15,
  })
  estimatedCost: number;

  @ApiPropertyOptional({
    description: 'When analysis was completed',
  })
  analysisCompletedAt?: Date;
}

export class ClipGenerationResponseDto {
  @ApiProperty({
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Current status',
    enum: ClipStatus,
    example: ClipStatus.COMPLETED,
  })
  status: ClipStatus;

  @ApiProperty({
    description: 'Selected theme used for generation',
    type: ThemeDto,
  })
  selectedTheme: ThemeDto;

  @ApiProperty({
    description: 'Number of clips requested',
    example: 5,
  })
  requestedClipCount: number;

  @ApiProperty({
    description: 'Generated clips',
    type: [GeneratedClipDto],
  })
  generatedClips: GeneratedClipDto[];

  @ApiProperty({
    description: 'Total tokens used for generation',
    example: 5000,
  })
  totalTokensUsed: number;

  @ApiProperty({
    description: 'Estimated cost for the generation in USD',
    example: 0.35,
  })
  estimatedCost: number;

  @ApiPropertyOptional({
    description: 'When generation was completed',
  })
  generationCompletedAt?: Date;
}

export class ClipListResponseDto {
  @ApiProperty({
    description: 'Array of clip projects',
    type: [ClipProjectResponseDto],
  })
  clips: ClipProjectResponseDto[];

  @ApiProperty({
    description: 'Total number of clips',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page (for pagination)',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}

// Query DTOs for filtering and pagination
export class ClipQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ClipStatus,
  })
  @IsOptional()
  @IsEnum(ClipStatus)
  status?: ClipStatus;

  @ApiPropertyOptional({
    description: 'Search in title and description',
    example: 'AI healthcare',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

// Signed URL Upload DTOs
export class UploadToSignedUrlRequestDto {
  @ApiProperty({
    description: 'Original filename with extension',
    example: 'my_video.mp4',
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 52428800,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  fileSize: number;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'video/mp4',
  })
  @IsString()
  mimeType: string;

  @ApiPropertyOptional({
    description: 'File type for organizing uploads',
    example: 'video',
    enum: ['video', 'audio', 'document', 'image', 'other'],
    default: 'other',
  })
  @IsOptional()
  @IsEnum(['video', 'audio', 'document', 'image', 'other'])
  fileType?: 'video' | 'audio' | 'document' | 'image' | 'other';

  @ApiPropertyOptional({
    description: 'Optional metadata for the file',
    example: { description: 'Marketing video for Q1 campaign' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Enable chunked upload for large files. If not specified, will auto-decide based on file size.',
    example: true,
    default: false,
  })
  @IsOptional()
  enableChunkedUpload?: boolean;

  @ApiPropertyOptional({
    description:
      'Chunk size in bytes for chunked upload (5MB to 100MB recommended)',
    example: 5242880, // 5MB
    minimum: 1024 * 1024, // 1MB minimum
    maximum: 100 * 1024 * 1024, // 100MB maximum
  })
  @IsOptional()
  @IsNumber()
  @Min(1024 * 1024)
  @Max(100 * 1024 * 1024)
  chunkSize?: number;
}

export class ChunkUploadInfo {
  @ApiProperty({
    description: 'Chunk number (1-based)',
    example: 1,
  })
  chunkNumber: number;

  @ApiProperty({
    description: 'Pre-signed URL for uploading this chunk',
    example:
      'https://s3.amazonaws.com/my-bucket/uploads/user123/abc-123-def.mp4?partNumber=1&uploadId=...',
  })
  signedUrl: string;

  @ApiProperty({
    description: 'Expiration time for this chunk URL (in seconds)',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Expected size of this chunk in bytes',
    example: 5242880, // 5MB
  })
  expectedSize: number;
}

export class SignedUrlUploadResponseDto {
  @ApiProperty({
    description: 'Indicates if this is a chunked upload',
    example: false,
  })
  isChunkedUpload: boolean;

  @ApiPropertyOptional({
    description: 'Pre-signed URL for file upload (single upload only)',
    example:
      'https://s3.amazonaws.com/my-bucket/uploads/user123/abc-123-def.mp4?X-Amz-Algorithm=...',
  })
  signedUrl?: string;

  @ApiProperty({
    description: 'Unique file identifier for tracking',
    example: 'user123_abc-123-def_my_video.mp4',
  })
  fileId: string;

  @ApiProperty({
    description: 'Final URL where file will be accessible after upload',
    example:
      'https://s3.amazonaws.com/my-bucket/uploads/user123/abc-123-def.mp4',
  })
  fileUrl: string;

  @ApiProperty({
    description: 'Pre-signed URL for reading/viewing the uploaded file',
    example:
      'https://s3.amazonaws.com/my-bucket/uploads/user123/abc-123-def.mp4?X-Amz-Algorithm=...',
  })
  readUrl: string;

  @ApiProperty({
    description: 'Expiration time for the signed URL (in seconds)',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Upload method to use (typically PUT for direct upload)',
    example: 'PUT',
  })
  method: string;

  @ApiPropertyOptional({
    description: 'Required headers for the upload request',
    example: { 'Content-Type': 'video/mp4' },
  })
  headers?: Record<string, string>;

  @ApiProperty({
    description: 'Maximum file size allowed for this upload',
    example: 104857600,
  })
  maxFileSize: number;

  @ApiProperty({
    description: 'Timestamp when the signed URL was created',
  })
  createdAt: Date;

  // Chunked upload specific fields
  @ApiPropertyOptional({
    description: 'Upload session ID for chunked uploads',
    example: 'session_abc123',
  })
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'S3 multipart upload ID for chunked uploads',
    example: 'upload_xyz789',
  })
  uploadId?: string;

  @ApiPropertyOptional({
    description: 'Total number of chunks',
    example: 10,
  })
  totalChunks?: number;

  @ApiPropertyOptional({
    description: 'Size of each chunk in bytes',
    example: 5242880,
  })
  chunkSize?: number;

  @ApiPropertyOptional({
    description: 'Array of signed URLs for each chunk',
    type: [ChunkUploadInfo],
  })
  chunkUrls?: ChunkUploadInfo[];
}

// Chunked upload management DTOs
export class UpdateChunkStatusDto {
  @ApiProperty({
    description: 'Upload session ID',
    example: 'session_abc123',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Chunk number (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  chunkNumber: number;

  @ApiProperty({
    description: 'ETag returned by S3 after chunk upload',
    example: '"d41d8cd98f00b204e9800998ecf8427e"',
  })
  @IsString()
  eTag: string;

  @ApiProperty({
    description: 'Actual size of uploaded chunk in bytes',
    example: 5242880,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  size: number;
}

export class CompleteChunkedUploadDto {
  @ApiProperty({
    description: 'Upload session ID',
    example: 'session_abc123',
  })
  @IsString()
  sessionId: string;
}

export class AbortChunkedUploadDto {
  @ApiProperty({
    description: 'Upload session ID',
    example: 'session_abc123',
  })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Reason for aborting the upload',
    example: 'User cancelled upload',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ChunkStatusInfo {
  @ApiProperty({
    description: 'Chunk number',
    example: 1,
  })
  chunkNumber: number;

  @ApiProperty({
    description: 'Whether this chunk has been uploaded',
    example: true,
  })
  isCompleted: boolean;

  @ApiProperty({
    description: 'ETag of uploaded chunk',
    example: '"d41d8cd98f00b204e9800998ecf8427e"',
  })
  eTag: string;

  @ApiProperty({
    description: 'Size of uploaded chunk in bytes',
    example: 5242880,
  })
  size: number;

  @ApiPropertyOptional({
    description: 'When this chunk was uploaded',
  })
  uploadedAt?: Date;
}

export class UploadProgressResponseDto {
  @ApiProperty({
    description: 'Upload session ID',
    example: 'session_abc123',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Current upload status',
    example: 'uploading',
    enum: ['initializing', 'uploading', 'completed', 'failed', 'aborted'],
  })
  status: string;

  @ApiProperty({
    description: 'Total number of chunks',
    example: 10,
  })
  totalChunks: number;

  @ApiProperty({
    description: 'Number of completed chunks',
    example: 7,
  })
  completedChunks: number;

  @ApiProperty({
    description: 'Upload progress percentage (0-100)',
    example: 70,
  })
  progressPercentage: number;

  @ApiProperty({
    description: 'Total file size in bytes',
    example: 52428800,
  })
  totalFileSize: number;

  @ApiProperty({
    description: 'Uploaded size in bytes',
    example: 36700160,
  })
  uploadedSize: number;

  @ApiProperty({
    description: 'Status of each chunk',
    type: [ChunkStatusInfo],
  })
  chunks: ChunkStatusInfo[];

  @ApiPropertyOptional({
    description: 'Final file URL (available when completed)',
    example:
      'https://s3.amazonaws.com/my-bucket/uploads/user123/abc-123-def.mp4',
  })
  finalFileUrl?: string;

  @ApiPropertyOptional({
    description: 'Error message if upload failed',
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Session creation timestamp',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Upload completion timestamp',
  })
  completedAt?: Date;

  @ApiProperty({
    description: 'Session expiration timestamp',
  })
  expiresAt: Date;
}

export class UploadStatusDto {
  @ApiProperty({
    description: 'File identifier',
    example: 'user123_abc-123-def_my_video.mp4',
  })
  fileId: string;

  @ApiProperty({
    description: 'Upload status',
    example: 'completed',
    enum: ['pending', 'uploading', 'completed', 'failed'],
  })
  status: 'pending' | 'uploading' | 'completed' | 'failed';

  @ApiProperty({
    description: 'Final file URL after successful upload',
    example:
      'https://s3.amazonaws.com/my-bucket/uploads/user123/abc-123-def.mp4',
  })
  fileUrl: string;

  @ApiPropertyOptional({
    description: 'Error message if upload failed',
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 52428800,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Upload completion timestamp',
  })
  uploadedAt: Date;
}
