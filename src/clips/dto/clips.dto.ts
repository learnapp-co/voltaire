import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsPositive,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ClipStatus,
  OpenAIModel,
  ClipMilestone,
} from '../../schemas/clip.schema';

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

  @ApiProperty({
    description: 'Current milestone/stage in the workflow',
    enum: ClipMilestone,
    example: ClipMilestone.RAW_CLIP,
  })
  milestone: ClipMilestone;

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
    description: 'User-defined themes for this project',
    example: ['Business', 'Educational', 'Funny Moments', 'Custom Theme'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  themes?: string[];
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
    description: 'Total video duration in seconds',
    example: 3600,
  })
  totalDuration?: number;

  @ApiProperty({
    description: 'User-defined themes for this project',
    example: ['Business', 'Educational', 'Funny Moments', 'Custom Theme'],
    type: [String],
  })
  themes: string[];

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

// Theme-based AI Clip Generation DTOs
export class GenerateClipsForThemeDto {
  @ApiProperty({
    description: 'Theme for AI clip generation (predefined or custom)',
    example: 'Transformation (then vs now)',
  })
  @IsString()
  theme: string;

  @ApiPropertyOptional({
    description: 'Maximum number of clips to generate (1-20)',
    example: 2,
    minimum: 1,
    maximum: 20,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxClips?: number;

  @ApiPropertyOptional({
    description: 'OpenAI model to use for clip generation',
    example: 'gpt-4.1-mini',
    default: 'gpt-4.1-mini',
    enum: OpenAIModel,
  })
  @IsOptional()
  @IsEnum(OpenAIModel, {
    message:
      'Invalid model. Use GET /clips/models/supported to see available models.',
  })
  model?: OpenAIModel;
}

export class ClipSegmentDto {
  @ApiProperty({
    description: 'Segment start time in HH:MM:SS,mmm format',
    example: '00:02:05,500',
  })
  startTime: string;

  @ApiProperty({
    description: 'Segment end time in HH:MM:SS,mmm format',
    example: '00:02:20,200',
  })
  endTime: string;

  @ApiProperty({
    description: 'Segment duration in seconds',
    example: 14.7,
  })
  duration: number;

  @ApiProperty({
    description: 'Narrative purpose of this segment',
    enum: ['hook', 'build', 'payoff'],
    example: 'hook',
  })
  purpose: string;

  @ApiProperty({
    description: 'Order of this segment within the Franken-Clip (1, 2, 3, 4)',
    example: 1,
  })
  sequenceOrder: number;
}

export class ThemeClipDto {
  @ApiProperty({
    description: 'Generated clip ID',
    example: '507f1f77bcf86cd799439012',
  })
  id: string;

  @ApiProperty({
    description: 'Clip sequence number within theme (1-20)',
    example: 1,
  })
  clipSequence: number;

  @ApiProperty({
    description: 'AI-generated title',
    example: 'The Hidden Truth About Making Money Online',
  })
  title: string;

  @ApiProperty({
    description: 'AI-generated description',
    example:
      'A compelling segment about the realities of online income generation',
  })
  description: string;

  @ApiProperty({
    description:
      'Clip timestamps (for backward compatibility, represents overall span)',
    example: {
      startTime: 125.5,
      endTime: 720.2,
      duration: 45.0,
    },
  })
  timeStamp: {
    startTime: number;
    endTime: number;
    duration: number;
  };

  @ApiProperty({
    description:
      'Individual segments for Franken-Clips (empty for traditional clips)',
    type: [ClipSegmentDto],
    example: [
      {
        startTime: '00:02:05,500',
        endTime: '00:02:20,200',
        duration: 14.7,
        purpose: 'hook',
        sequenceOrder: 1,
      },
      {
        startTime: '00:06:20,100',
        endTime: '00:06:35,800',
        duration: 15.7,
        purpose: 'build',
        sequenceOrder: 2,
      },
      {
        startTime: '00:12:00,000',
        endTime: '00:12:14,500',
        duration: 14.5,
        purpose: 'payoff',
        sequenceOrder: 3,
      },
    ],
  })
  segments: ClipSegmentDto[];

  @ApiPropertyOptional({
    description:
      'Total combined duration of all segments (for Franken-Clips) - max 180 seconds (3 minutes)',
    example: 45.0,
    maximum: 180,
  })
  totalDuration?: number;

  @ApiProperty({
    description: 'Whether this is a Franken-Clip with multiple segments',
    example: true,
  })
  isFrankenClip: boolean;

  @ApiProperty({
    description: 'Transcript text for this clip (combined from all segments)',
    example:
      "So here's what nobody tells you about making money online... [...] The reality is that most people fail because... [...] But if you understand this one principle...",
  })
  transcript: string;

  @ApiProperty({
    description: 'AI metadata',
    example: {
      confidence: 0.85,
      keywords: ['money', 'online', 'truth'],
      hashtags: ['#money', '#business', '#truth'],
      reasoning:
        'This Franken-Clip creates a compelling narrative arc about online money-making by combining a hook about hidden truths, building tension with failure statistics, and delivering a solution.',
    },
  })
  aiMetadata: {
    confidence: number;
    keywords: string[];
    hashtags: string[];
    reasoning?: string;
  };

  @ApiPropertyOptional({
    description: 'Generated video URL (once processed)',
    example: 'https://bucket.s3.amazonaws.com/clips/project123/clip_001.mp4',
  })
  videoUrl?: string;

  @ApiPropertyOptional({
    description: 'Raw clip URL (direct access)',
    example:
      'https://bucket.s3.amazonaws.com/clips/project123/raw_clip_001.mp4',
  })
  rawClipUrl?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 15728640,
  })
  fileSize?: number;

  @ApiProperty({
    description: 'Processing status',
    enum: ['pending', 'processing', 'completed', 'failed', 'discarded'],
    example: 'completed',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Processing error message if failed',
  })
  processingError?: string;

  @ApiProperty({
    description: 'When this clip was generated',
  })
  generatedAt: Date;

  @ApiProperty({
    description: 'Current milestone/stage in the workflow',
    enum: ClipMilestone,
    example: ClipMilestone.RAW_CLIP,
  })
  milestone: ClipMilestone;

  @ApiPropertyOptional({
    description: 'When video processing was completed',
  })
  processingCompletedAt?: Date;
}

export class ThemeGenerationResponseDto {
  @ApiProperty({
    description: 'Generation batch ID',
    example: 'gen_123e4567-e89b-12d3-a456-426614174000',
  })
  generationId: string;

  @ApiProperty({
    description: 'Theme name',
    example: 'Money',
  })
  theme: string;

  @ApiProperty({
    description: 'Total clips generated',
    example: 15,
  })
  totalClips: number;

  @ApiProperty({
    description: 'Number of clips successfully processed',
    example: 14,
  })
  processedClips: number;

  @ApiProperty({
    description: 'Number of clips that failed processing',
    example: 1,
  })
  failedClips: number;

  @ApiProperty({
    description: 'Generated clips for this theme',
    type: [ThemeClipDto],
  })
  clips: ThemeClipDto[];
}

export class RefineClipDto {
  @ApiProperty({
    description: 'New start time in seconds',
    example: 130.0,
  })
  @IsNumber()
  @Min(0)
  startTime: number;

  @ApiProperty({
    description: 'New end time in seconds',
    example: 185.5,
  })
  @IsNumber()
  @Min(0)
  endTime: number;
}

export class ProjectThemesResponseDto {
  @ApiProperty({
    description: 'Project ID',
    example: '507f1f77bcf86cd799439011',
  })
  projectId: string;

  @ApiProperty({
    description: 'All themes in this project with their clips',
    example: {
      Money: [
        { id: '1', title: 'Making Money Online', status: 'completed' },
        { id: '2', title: 'Investment Tips', status: 'completed' },
      ],
      Business: [
        { id: '3', title: 'Starting a Business', status: 'processing' },
      ],
    },
  })
  themes: { [themeName: string]: ThemeClipDto[] };

  @ApiProperty({
    description: 'Total number of themes',
    example: 2,
  })
  totalThemes: number;

  @ApiProperty({
    description: 'Total number of clips across all themes',
    example: 25,
  })
  totalClips: number;
}

export class PredefinedThemesResponseDto {
  @ApiProperty({
    description: 'List of predefined themes',
    example: [
      'Action Sequences',
      'Breaking stereotypes or taboos',
      'Business',
      'Controversial',
      'Educational',
      'Emotional Moments',
      'Firsts and breakthroughs (first paycheck, big break, first failure)',
      'Funny Moments',
      'Hacks or hard-earned lessons',
      'Highlights',
      'Inspirational',
      'Key Points',
      'Money',
      'Money, fame, or industry truths',
      'Transformation (then vs now)',
      'Vulnerability (burnout, fear, comparison, loneliness)',
    ],
  })
  themes: string[];
}

export class AllThemesResponseDto {
  @ApiProperty({
    description: 'List of all available themes (predefined + custom)',
    example: [
      'Breaking stereotypes or taboos',
      'Business',
      'Creative Content',
      'Educational',
      'Firsts and breakthroughs (first paycheck, big break, first failure)',
      'Funny Moments',
      'Hacks or hard-earned lessons',
      'Highlights',
      'Money, fame, or industry truths',
      'Personal Story',
      'Tech Tips',
      'Transformation (then vs now)',
      'Vulnerability (burnout, fear, comparison, loneliness)',
    ],
  })
  themes: string[];

  @ApiProperty({
    description: 'Total number of themes available',
    example: 10,
  })
  totalThemes: number;
}

export class CustomThemesResponseDto {
  @ApiProperty({
    description: 'List of custom themes that have been used',
    example: ['Creative Content', 'Personal Story', 'Tech Tips'],
  })
  themes: string[];
}

export class SupportedModelDto {
  @ApiProperty({
    description: 'Model identifier',
    example: 'gpt-4o-mini',
  })
  id: string;

  @ApiProperty({
    description: 'Human-readable model name',
    example: 'GPT-4 Mini',
  })
  name: string;

  @ApiProperty({
    description: 'Model description',
    example: 'Fast and cost-effective model for AI clip generation',
  })
  description: string;

  @ApiProperty({
    description: 'Maximum token limit for this model',
    example: 128000,
  })
  maxTokens: number;

  @ApiProperty({
    description: 'Whether this model is recommended',
    example: true,
  })
  isRecommended: boolean;
}

export class SupportedModelsResponseDto {
  @ApiProperty({
    description: 'List of supported AI models for clip generation',
    type: [SupportedModelDto],
    example: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4 Mini',
        description: 'Fast and cost-effective model for AI clip generation',
        maxTokens: 128000,
        isRecommended: true,
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Advanced model with high-quality clip generation',
        maxTokens: 8192,
        isRecommended: false,
      },
    ],
  })
  models: SupportedModelDto[];

  @ApiProperty({
    description: 'Default model to use if none specified',
    example: 'gpt-4o-mini',
  })
  defaultModel: string;
}

// AI Clip Editing DTOs
export class AIGeneratedClipDto {
  @ApiProperty({
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  id: string;

  @ApiProperty({
    description: 'Project ID this clip belongs to',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  projectId: string;

  @ApiProperty({
    description: 'Theme name',
    example: 'Money, fame, or industry truths',
  })
  theme: string;

  @ApiProperty({
    description: 'Whether this is a custom theme',
    example: false,
  })
  isCustomTheme: boolean;

  @ApiProperty({
    description: 'Generation batch ID',
    example: 'gen_123e4567-e89b-12d3-a456-426614174000',
  })
  generationId: string;

  @ApiProperty({
    description: 'Clip sequence number within theme',
    example: 1,
  })
  clipSequence: number;

  @ApiProperty({
    description: 'AI-generated title',
    example: '🔥 The Truth About Making Your First Million',
  })
  title: string;

  @ApiProperty({
    description: 'AI-generated description',
    example: 'Entrepreneur shares the reality of building wealth from scratch',
  })
  description: string;

  @ApiProperty({
    description: 'Main timestamp for backward compatibility',
    type: Object,
  })
  timeStamp: {
    startTime: number;
    endTime: number;
    duration: number;
  };

  @ApiProperty({
    description: 'Clip segments (for Franken-Clips)',
    type: [ClipSegmentDto],
  })
  segments: ClipSegmentDto[];

  @ApiProperty({
    description: 'Total duration of all segments combined',
    example: 67.5,
    required: false,
  })
  totalDuration?: number;

  @ApiProperty({
    description: 'Whether this is a Franken-Clip with multiple segments',
    example: true,
  })
  isFrankenClip: boolean;

  @ApiProperty({
    description: 'Transcript text for this clip',
    example: "So here's what nobody tells you about making money online...",
  })
  transcript: string;

  @ApiProperty({
    description: 'AI metadata',
    type: Object,
  })
  aiMetadata: {
    confidence: number;
    keywords: string[];
    hashtags: string[];
    reasoning?: string;
  };

  @ApiProperty({
    description: 'Generated video URL',
    example:
      'https://clipflow-bucket.s3.amazonaws.com/clips/project123/clip456.mp4',
    required: false,
  })
  videoUrl?: string;

  @ApiProperty({
    description: 'Generated clip URL',
    example:
      'https://clipflow-bucket.s3.amazonaws.com/clips/project123/clip456.mp4',
    required: false,
  })
  rawClipUrl?: string;

  @ApiProperty({
    description: 'Generated clip filename',
    example: 'clip_001_edited.mp4',
    required: false,
  })
  fileName?: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 15728640,
    required: false,
  })
  fileSize?: number;

  @ApiProperty({
    description: 'Processing status',
    enum: ['pending', 'processing', 'completed', 'failed', 'discarded'],
    example: 'completed',
  })
  status: string;

  @ApiProperty({
    description: 'Processing error message if failed',
    required: false,
  })
  processingError?: string;

  @ApiProperty({
    description: 'Whether user liked this clip',
    example: false,
  })
  isLiked: boolean;

  @ApiProperty({
    description: 'Whether user bookmarked this clip',
    example: false,
  })
  isBookmarked: boolean;

  @ApiProperty({
    description: 'View count',
    example: 5,
  })
  viewCount: number;

  @ApiProperty({
    description: 'Whether this clip is archived',
    example: false,
  })
  isArchived: boolean;

  @ApiProperty({
    description: 'When the clip was archived',
    required: false,
  })
  archivedAt?: Date;

  @ApiProperty({
    description: 'Who archived the clip',
    example: 'john@example.com',
    required: false,
  })
  archivedBy?: string;

  @ApiProperty({
    description: 'History of timestamp refinements',
    type: [Object],
  })
  refinementHistory: any[];

  @ApiProperty({
    description: 'Original AI-suggested timestamp before refinements',
    type: Object,
    required: false,
  })
  originalTimeStamp?: {
    startTime: number;
    endTime: number;
    duration: number;
  };

  @ApiProperty({
    description: 'AWS metadata',
    type: Object,
    required: false,
  })
  awsMetadata?: {
    bucket?: string;
    key?: string;
    region?: string;
    uploadedAt?: Date;
  };

  @ApiProperty({
    description: 'When AI generated this clip metadata',
    required: false,
  })
  generatedAt?: Date;

  @ApiProperty({
    description: 'When video processing started',
    required: false,
  })
  processingStartedAt?: Date;

  @ApiProperty({
    description: 'When video processing completed',
    required: false,
  })
  processingCompletedAt?: Date;

  @ApiProperty({
    description: 'Last time user refined this clip',
    required: false,
  })
  lastRefinedAt?: Date;

  @ApiProperty({
    description: 'Title and thumbnail generation data',
    type: Object,
    required: false,
  })
  titleThumbnailGeneration?: any;

  @ApiProperty({
    description: 'Additional metadata',
    type: Object,
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Created timestamp',
    required: false,
  })
  createdAt?: Date;

  @ApiProperty({
    description: 'Updated timestamp',
    required: false,
  })
  updatedAt?: Date;
}

export class EditClipSegmentDto {
  @ApiProperty({
    description: 'Start time in HH:MM:SS,mmm format',
    example: '00:00:10,500',
  })
  @IsString()
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:MM:SS,mmm format',
    example: '00:00:35,200',
  })
  @IsString()
  endTime: string;

  @ApiProperty({
    description: 'Segment purpose/label',
    example: 'Hook: Opening that grabs attention',
    required: false,
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({
    description: 'Sequence order within the clip',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  sequenceOrder?: number;
}

export class EditAIClipRequestDto {
  @ApiProperty({
    description: 'Updated clip title',
    example: '🔥 The Truth About Making Your First Million',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({
    description: 'Updated clip description',
    example: 'Entrepreneur shares the reality of building wealth from scratch',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Modified clip segments with new timestamps',
    type: [EditClipSegmentDto],
    example: [
      {
        startTime: 10.5,
        endTime: 35.2,
        purpose: 'Hook: Opening that grabs attention',
        sequenceOrder: 1,
      },
      {
        startTime: 125.8,
        endTime: 150.3,
        purpose: 'Build: Supporting content',
        sequenceOrder: 2,
      },
    ],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditClipSegmentDto)
  segments?: EditClipSegmentDto[];

  @ApiProperty({
    description: 'Whether to immediately regenerate the video',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  regenerateVideo?: boolean = true;
}

export class EditedClipSegmentDto {
  @ApiProperty({
    description: 'Start time in seconds',
    example: 10.5,
  })
  startTime: number;

  @ApiProperty({
    description: 'End time in seconds',
    example: 35.2,
  })
  endTime: number;

  @ApiProperty({
    description: 'Duration in seconds',
    example: 24.7,
  })
  duration: number;

  @ApiProperty({
    description: 'Segment purpose/label',
    example: 'Hook: Opening that grabs attention',
  })
  purpose: string;

  @ApiProperty({
    description: 'Sequence order within the clip',
    example: 1,
  })
  sequenceOrder: number;
}

export class EditAIClipResponseDto {
  @ApiProperty({
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  id: string;

  @ApiProperty({
    description: 'Updated clip title',
    example: '🔥 The Truth About Making Your First Million',
  })
  title: string;

  @ApiProperty({
    description: 'Updated clip description',
    example: 'Entrepreneur shares the reality of building wealth from scratch',
  })
  description: string;

  @ApiProperty({
    description: 'Updated clip segments',
    type: [EditedClipSegmentDto],
  })
  segments: EditedClipSegmentDto[];

  @ApiProperty({
    description: 'Total duration of all segments combined',
    example: 67.5,
  })
  totalDuration: number;

  @ApiProperty({
    description: 'Current clip status',
    example: 'processing',
    enum: ['pending', 'processing', 'completed', 'failed'],
  })
  status: string;

  @ApiProperty({
    description: 'Updated video URL (if regeneration completed)',
    example:
      'https://clipflow-bucket.s3.amazonaws.com/clips/project123/clip456.mp4',
    required: false,
  })
  videoUrl?: string;

  @ApiProperty({
    description: 'Timestamp when the clip was last edited',
    example: '2024-01-15T10:30:00Z',
  })
  lastEditedAt: Date;

  @ApiProperty({
    description: 'Refinement history showing previous versions',
    type: [Object],
    example: [
      {
        startTime: 5.0,
        endTime: 30.0,
        duration: 25.0,
        editedAt: '2024-01-15T09:15:00Z',
      },
    ],
  })
  refinementHistory: any[];
}

export class ClipEditValidationErrorDto {
  @ApiProperty({
    description: 'Error code',
    example: 'INVALID_SEGMENT_DURATION',
  })
  code: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Segment duration must be between 5 and 60 seconds',
  })
  message: string;

  @ApiProperty({
    description: 'Field that caused the error',
    example: 'segments[0].duration',
    required: false,
  })
  field?: string;
}

// Archive DTOs
export class ArchiveClipRequestDto {
  @ApiProperty({
    description: 'Reason for archiving (optional)',
    example: 'Not relevant for current campaign',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ArchiveClipResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Operation message',
    example: 'Clip archived successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated archive status',
    example: true,
  })
  isArchived: boolean;

  @ApiProperty({
    description: 'When the clip was archived/unarchived',
    example: '2024-01-15T10:30:00Z',
  })
  archivedAt?: Date;
}

export class ArchivedClipsQueryDto {
  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by theme',
    example: 'Money',
    required: false,
  })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({
    description: 'Filter by archive date range (start)',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  archivedAfter?: Date;

  @ApiProperty({
    description: 'Filter by archive date range (end)',
    example: '2024-01-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  archivedBefore?: Date;
}

export class ArchivedClipDto {
  @ApiProperty({
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  id: string;

  @ApiProperty({
    description: 'Clip title',
    example: '🔥 The Truth About Making Your First Million',
  })
  title: string;

  @ApiProperty({
    description: 'Clip description',
    example: 'Entrepreneur shares the reality of building wealth from scratch',
  })
  description: string;

  @ApiProperty({
    description: 'Theme name',
    example: 'Money, fame, or industry truths',
  })
  theme: string;

  @ApiProperty({
    description: 'Clip sequence number',
    example: 1,
  })
  clipSequence: number;

  @ApiProperty({
    description: 'Total duration in seconds',
    example: 67.5,
  })
  totalDuration: number;

  @ApiProperty({
    description: 'Video URL',
    example:
      'https://clipflow-bucket.s3.amazonaws.com/clips/project123/clip456.mp4',
  })
  videoUrl: string;

  @ApiProperty({
    description: 'When the clip was archived',
    example: '2024-01-15T10:30:00Z',
  })
  archivedAt: Date;

  @ApiProperty({
    description: 'Who archived the clip',
    example: 'john@example.com',
  })
  archivedBy: string;

  @ApiProperty({
    description: 'When the clip was originally generated',
    example: '2024-01-10T09:15:00Z',
  })
  generatedAt: Date;
}

export class ArchivedClipsResponseDto {
  @ApiProperty({
    description: 'List of archived clips',
    type: [ArchivedClipDto],
  })
  clips: ArchivedClipDto[];

  @ApiProperty({
    description: 'Total number of archived clips',
    example: 25,
  })
  totalClips: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  currentPage: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Number of clips per page',
    example: 10,
  })
  limit: number;
}

// Theme Analysis DTOs
export class ThemeAnalysisResponseDto {
  @ApiProperty({
    description: 'List of themes extracted from SRT content',
    type: [String],
    example: [
      'Business Strategy',
      'Personal Development',
      'Technology',
      'Finance',
      'Leadership',
      'Marketing',
    ],
  })
  themes: string[];

  @ApiProperty({
    description: 'Total number of themes found',
    example: 6,
  })
  totalThemes: number;

  @ApiProperty({
    description: 'Clip project ID that was analyzed',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  projectId: string;

  @ApiProperty({
    description: 'When the analysis was performed',
    example: '2024-01-15T10:30:00Z',
  })
  analyzedAt: Date;
}
