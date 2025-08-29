import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsPositive,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClipStatus } from '../../schemas/clip.schema';

// Create Clip Project DTO
export class CreateClipProjectWithSrtDto {
  @ApiProperty({
    description: 'Project name',
    example: 'My Podcast Episode',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Direct video file URL or AWS S3 URL',
    example: 'https://bucket.s3.amazonaws.com/videos/my-video.mp4',
  })
  @IsString()
  videoUrl: string;
}

// Query DTOs for pagination
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
}

// Generated Clip DTOs
export class ClipTimestamp {
  @ApiProperty({
    description: 'Clip identifier',
    example: 'clip_001',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Start time in seconds',
    example: 30.5,
  })
  @IsNumber()
  startTime: number;

  @ApiProperty({
    description: 'End time in seconds',
    example: 90.5,
  })
  @IsNumber()
  endTime: number;

  @ApiProperty({
    description: 'Clip title/description',
    example: 'Introduction segment',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Optional clip description',
    example: 'Opening remarks and introduction',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class GeneratedClipDto {
  @ApiProperty({
    description: 'Original user-provided clip ID',
    example: 'ai-theme-1',
  })
  id: string;

  @ApiProperty({
    description: 'Database ID for clip modifications',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  dbId: string;

  @ApiProperty({
    description: 'Clip title/name',
    example: 'Introduction segment',
  })
  title: string;

  @ApiProperty({
    description: 'Start time in seconds',
    example: 30.5,
  })
  startTime: number;

  @ApiProperty({
    description: 'End time in seconds',
    example: 90.5,
  })
  endTime: number;

  @ApiProperty({
    description: 'Duration in seconds',
    example: 60,
  })
  duration: number;

  @ApiProperty({
    description: 'AWS S3 URL of the generated clip',
    example: 'https://your-bucket.s3.amazonaws.com/clips/clip_001.mp4',
  })
  clipUrl: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 15728640,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Generation timestamp',
  })
  generatedAt: Date;

  @ApiPropertyOptional({
    description: 'Processing status',
    example: 'completed',
  })
  processingStatus?: string;
}

// Update Clip Project DTO
export class UpdateClipProjectDto {
  @ApiPropertyOptional({
    description: 'Updated project title',
    example: 'Updated Clip Project',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Updated description of the clip project',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Generated clips with timestamps',
    type: [GeneratedClipDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratedClipDto)
  generatedClips?: GeneratedClipDto[];
}

// Generate Clips DTO
export class GenerateClipsDto {
  @ApiProperty({
    description: 'Array of clip timestamps to generate',
    type: [ClipTimestamp],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClipTimestamp)
  timestamps: ClipTimestamp[];

  @ApiPropertyOptional({
    description: 'Output video quality',
    example: 'high',
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  })
  @IsOptional()
  quality?: string;

  @ApiPropertyOptional({
    description: 'Video format for generated clips',
    example: 'mp4',
    enum: ['mp4', 'mov', 'avi'],
    default: 'mp4',
  })
  @IsOptional()
  format?: string;
}

// Regenerate Single Clip DTO
export class RegenerateClipDto {
  @ApiProperty({
    description: 'Database ID of the clip to regenerate',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @IsString()
  dbId: string;

  @ApiPropertyOptional({
    description: 'Updated start time in seconds',
    example: 35.0,
  })
  @IsOptional()
  @IsNumber()
  startTime?: number;

  @ApiPropertyOptional({
    description: 'Updated end time in seconds',
    example: 95.0,
  })
  @IsOptional()
  @IsNumber()
  endTime?: number;

  @ApiPropertyOptional({
    description: 'Updated clip title',
    example: 'Updated Introduction segment',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated description',
    example: 'Updated description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

// S3 Upload DTOs
export class SignedUrlRequestDto {
  @ApiProperty({
    description: 'Original file name',
    example: 'my-video.mp4',
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: 'File MIME type',
    example: 'video/mp4',
  })
  @IsString()
  fileType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 52428800,
  })
  @IsNumber()
  fileSize: number;
}

export class SignedUrlResponseDto {
  @ApiProperty({
    description: 'Pre-signed URL for uploading to S3',
    example:
      'https://bucket.s3.amazonaws.com/videos/uuid.mp4?X-Amz-Algorithm=...',
  })
  uploadUrl: string;

  @ApiProperty({
    description: 'Final S3 URL where the file will be accessible',
    example: 'https://bucket.s3.amazonaws.com/videos/uuid.mp4',
  })
  fileUrl: string;

  @ApiProperty({
    description: 'Generated unique file name',
    example: 'videos/550e8400-e29b-41d4-a716-446655440000.mp4',
  })
  fileName: string;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    example: 3600,
  })
  expiresIn: number;
}

// Multipart Upload DTOs
export class InitiateMultipartUploadDto {
  @ApiProperty({
    description: 'Original file name',
    example: 'large-video.mp4',
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: 'File MIME type',
    example: 'video/mp4',
  })
  @IsString()
  fileType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 524288000,
  })
  @IsNumber()
  fileSize: number;
}

export class InitiateMultipartUploadResponseDto {
  @ApiProperty({
    description: 'Upload ID for the multipart upload session',
    example: '2~VmxqYWJRNHlzaTV4MGZSczNvZGJPSgabcd123',
  })
  uploadId: string;

  @ApiProperty({
    description: 'S3 file key for the upload',
    example: 'videos/550e8400-e29b-41d4-a716-446655440000.mp4',
  })
  fileKey: string;

  @ApiProperty({
    description: 'Final S3 URL where the file will be accessible',
    example:
      'https://bucket.s3.amazonaws.com/videos/550e8400-e29b-41d4-a716-446655440000.mp4',
  })
  fileUrl: string;

  @ApiProperty({
    description: 'Size of each chunk in bytes',
    example: 10485760,
  })
  chunkSize: number;

  @ApiProperty({
    description: 'Total number of chunks',
    example: 50,
  })
  totalChunks: number;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    example: 3600,
  })
  expiresIn: number;
}

export class ChunkUploadUrlRequestDto {
  @ApiProperty({
    description: 'Upload ID from initiate multipart upload',
    example: '2~VmxqYWJRNHlzaTV4MGZSczNvZGJPSgabcd123',
  })
  @IsString()
  uploadId: string;

  @ApiProperty({
    description: 'S3 file key',
    example: 'videos/550e8400-e29b-41d4-a716-446655440000.mp4',
  })
  @IsString()
  fileKey: string;

  @ApiProperty({
    description: 'Part number for the chunk (1-based)',
    example: 1,
  })
  @IsNumber()
  @IsPositive()
  partNumber: number;
}

export class ChunkUploadUrlResponseDto {
  @ApiProperty({
    description: 'Pre-signed URL for uploading this chunk',
    example:
      'https://bucket.s3.amazonaws.com/videos/uuid.mp4?partNumber=1&uploadId=...',
  })
  uploadUrl: string;

  @ApiProperty({
    description: 'Part number for this chunk',
    example: 1,
  })
  partNumber: number;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    example: 3600,
  })
  expiresIn: number;
}

export class UploadPartDto {
  @ApiProperty({
    description: 'Part number',
    example: 1,
  })
  @IsNumber()
  @IsPositive()
  partNumber: number;

  @ApiProperty({
    description: 'ETag returned from S3 after uploading the chunk',
    example: '"e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6"',
  })
  @IsString()
  etag: string;
}

export class CompleteMultipartUploadDto {
  @ApiProperty({
    description: 'Upload ID from initiate multipart upload',
    example: '2~VmxqYWJRNHlzaTV4MGZSczNvZGJPSgabcd123',
  })
  @IsString()
  uploadId: string;

  @ApiProperty({
    description: 'S3 file key',
    example: 'videos/550e8400-e29b-41d4-a716-446655440000.mp4',
  })
  @IsString()
  fileKey: string;

  @ApiProperty({
    description: 'Array of uploaded parts with their ETags',
    type: [UploadPartDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadPartDto)
  parts: UploadPartDto[];
}

export class CompleteMultipartUploadResponseDto {
  @ApiProperty({
    description: 'Final S3 URL where the file is accessible',
    example:
      'https://bucket.s3.amazonaws.com/videos/550e8400-e29b-41d4-a716-446655440000.mp4',
  })
  fileUrl: string;

  @ApiProperty({
    description: 'S3 file key',
    example: 'videos/550e8400-e29b-41d4-a716-446655440000.mp4',
  })
  fileKey: string;
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
    example: 'Podcast Episode 123',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'Discussion about technology',
  })
  description?: string;

  @ApiProperty({
    description: 'Current processing status',
    enum: ClipStatus,
    example: ClipStatus.PENDING,
  })
  status: ClipStatus;

  @ApiProperty({
    description: 'Raw video file information',
    example: {
      url: 'https://bucket.s3.amazonaws.com/videos/podcast_episode.mp4',
      fileName: 'podcast_episode.mp4',
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
      fileName: 'episode_subtitles.srt',
      url: '/uploads/srt/episode_subtitles.srt',
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

  @ApiProperty({
    description: 'Project creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Project last update timestamp',
  })
  updatedAt: Date;
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
    description: 'Number of clips requested',
    example: 5,
  })
  requestedClipCount: number;

  @ApiProperty({
    description: 'Generated clips',
    type: [GeneratedClipDto],
  })
  generatedClips: GeneratedClipDto[];

  @ApiPropertyOptional({
    description: 'When generation was completed',
  })
  generationCompletedAt?: Date;
}
