import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClipDocument = Clip & Document;

export enum ClipStatus {
  PENDING = 'pending',
  ANALYZING = 'analyzing',
  READY_FOR_GENERATION = 'ready_for_generation',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ClipMilestone {
  RAW_CLIP = 'Raw Clip',
  CLIP_SELECTION = 'Clip Selection(Voting)',
  TITLE_THUMBNAIL = 'Title & thumbnail header',
  FINAL_EDIT = 'Final edit',
  SET_ALERT = 'Set Alert',
}

export enum OpenAIModel {
  // GPT-4.1 family (latest with 1M context)
  GPT_4_1_MINI = 'gpt-4.1-mini',
  // GPT-4o family (current generation)
  GPT_4O = 'gpt-4o',
  GPT_4O_MINI = 'gpt-4o-mini',

  // GPT-5 family (next generation with 400K context)
  GPT_5 = 'gpt-5',

  // GPT-4 family (previous generation)
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_4_TURBO_PREVIEW = 'gpt-4-turbo-preview',
  GPT_4 = 'gpt-4',
  GPT_4_0613 = 'gpt-4-0613',
  GPT_4_32K = 'gpt-4-32k',
  GPT_4_32K_0613 = 'gpt-4-32k-0613',

  // GPT-3.5 family (cost-effective)
  GPT_3_5_TURBO = 'gpt-3.5-turbo',
  GPT_3_5_TURBO_16K = 'gpt-3.5-turbo-16k',
  GPT_3_5_TURBO_1106 = 'gpt-3.5-turbo-1106',
  GPT_3_5_TURBO_0613 = 'gpt-3.5-turbo-0613',
  GPT_3_5_TURBO_16K_0613 = 'gpt-3.5-turbo-16k-0613',
}

// Extended AI models for title/thumbnail generation
export enum AIModel {
  // OpenAI models (subset of most useful for title/thumbnail generation)
  GPT_4O = 'gpt-4o',
  GPT_4O_MINI = 'gpt-4o-mini',
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_4 = 'gpt-4',
  GPT_3_5_TURBO = 'gpt-3.5-turbo',

  // Other AI providers (future support)
  CLAUDE = 'claude',
  GEMINI = 'gemini',
}

// Predefined tones for title/thumbnail generation
export enum TitleTone {
  EDUCATIONAL = 'Educational',
  BOLD_CONTROVERSIAL = 'Bold & Controversial',
  INSPIRATIONAL = 'Inspirational',
  HUMOROUS = 'Humorous',
  RELATABLE = 'Relatable',
  URGENT_TIMELY = 'Urgent/Timely',
  INTRIGUING_MYSTERIOUS = 'Intriguing/Mysterious',
  MOTIVATIONAL = 'Motivational',
  NOSTALGIC_SENTIMENTAL = 'Nostalgic/Sentimental',
  ASPIRATIONAL_LUXURIOUS = 'Aspirational / Luxurious',
  SURPRISING_UNEXPECTED = 'Surprising/Unexpected',
}

@Schema()
export class Theme {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  angle: string;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [Number], default: [] })
  timeRanges: number[]; // Array of [start, end] timestamps in seconds
}

@Schema()
export class VoteDetail {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  votedAt: Date;
}

@Schema()
export class PostingVotes {
  @Prop({ type: [VoteDetail], default: [] })
  yes: VoteDetail[];

  @Prop({ type: [VoteDetail], default: [] })
  no: VoteDetail[];
}

@Schema()
export class RatingVotes {
  @Prop({ type: [VoteDetail], default: [] })
  rating1: VoteDetail[];

  @Prop({ type: [VoteDetail], default: [] })
  rating2: VoteDetail[];

  @Prop({ type: [VoteDetail], default: [] })
  rating3: VoteDetail[];

  @Prop({ type: [VoteDetail], default: [] })
  rating4: VoteDetail[];

  @Prop({ type: [VoteDetail], default: [] })
  rating5: VoteDetail[];
}

@Schema()
export class ClipVoting {
  @Prop({ type: PostingVotes, default: () => ({}) })
  shouldThisBePosted: PostingVotes;

  @Prop({ type: RatingVotes, default: () => ({}) })
  clipRating: RatingVotes;
}

// Title/Thumbnail Generation Schemas
@Schema()
export class GeneratedTitle {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  tone: string; // Can be from TitleTone enum or custom

  @Prop({ required: true, enum: AIModel })
  aiModel: AIModel;

  @Prop({ required: true })
  generatedAt: Date;

  @Prop({ default: false })
  isCustom: boolean; // True if manually added by user
}

@Schema()
export class GeneratedThumbnailHeader {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  tone: string; // Can be from TitleTone enum or custom

  @Prop({ required: true, enum: AIModel })
  aiModel: AIModel;

  @Prop({ required: true })
  generatedAt: Date;

  @Prop({ default: false })
  isCustom: boolean; // True if manually added by user
}

@Schema()
export class TitleThumbnailVoteDetail {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  votedAt: Date;

  @Prop({ type: [String], required: true })
  selectedOptions: string[]; // Array of title/thumbnail IDs voted for
}

@Schema()
export class TitleVoting {
  @Prop({ default: false })
  isPollActive: boolean;

  @Prop()
  pollCreatedAt?: Date;

  @Prop()
  pollDeadline?: Date;

  @Prop({ type: [TitleThumbnailVoteDetail], default: [] })
  votes: TitleThumbnailVoteDetail[];

  @Prop({ type: [String], default: [] })
  pollOptions: string[]; // Array of GeneratedTitle IDs included in poll

  @Prop({ default: false })
  isPollClosed: boolean;

  @Prop()
  finalSelection?: string; // Selected title ID

  @Prop({ default: false })
  isSaved: boolean;
}

@Schema()
export class ThumbnailVoting {
  @Prop({ default: false })
  isPollActive: boolean;

  @Prop()
  pollCreatedAt?: Date;

  @Prop()
  pollDeadline?: Date;

  @Prop({ type: [TitleThumbnailVoteDetail], default: [] })
  votes: TitleThumbnailVoteDetail[];

  @Prop({ type: [String], default: [] })
  pollOptions: string[]; // Array of GeneratedThumbnailHeader IDs included in poll

  @Prop({ default: false })
  isPollClosed: boolean;

  @Prop()
  finalSelection?: string; // Selected thumbnail header ID

  @Prop({ default: false })
  isSaved: boolean;
}

@Schema()
export class TitleThumbnailGeneration {
  @Prop({ type: [GeneratedTitle], default: [] })
  generatedTitles: GeneratedTitle[];

  @Prop({ type: [GeneratedThumbnailHeader], default: [] })
  generatedThumbnailHeaders: GeneratedThumbnailHeader[];

  @Prop({ type: [String], default: [] })
  selectedTones: string[]; // Array of tones (TitleTone enum values + custom)

  @Prop({ enum: AIModel, default: AIModel.GPT_4O })
  selectedAIModel: AIModel;

  @Prop({ type: TitleVoting, default: () => ({}) })
  titleVoting: TitleVoting;

  @Prop({ type: ThumbnailVoting, default: () => ({}) })
  thumbnailVoting: ThumbnailVoting;

  @Prop({ default: false })
  isComplete: boolean; // True when both title and thumbnail are saved
}

@Schema()
export class Collaborator {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  addedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  addedBy: Types.ObjectId; // User who added this collaborator
}

@Schema()
export class GeneratedClip {
  @Prop({ required: true })
  clipId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  startTime: number; // In seconds

  @Prop({ required: true })
  endTime: number; // In seconds

  @Prop({ required: true })
  duration: number; // In seconds

  @Prop({ required: true })
  transcript: string;

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop()
  videoUrl?: string; // URL to the generated video clip

  @Prop()
  clipUrl?: string; // URL to the generated clip (alias for videoUrl)

  @Prop()
  fileSize?: number; // File size in bytes

  @Prop({
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  })
  processingStatus: string;

  @Prop()
  processingError?: string; // Error message if processing failed

  @Prop({ default: Date.now })
  generatedAt: Date;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  // Milestone tracking for workflow stages
  @Prop({ enum: ClipMilestone, default: ClipMilestone.RAW_CLIP })
  milestone: ClipMilestone;

  // Voting system for each generated clip
  @Prop({ type: ClipVoting, default: () => ({}) })
  voting: ClipVoting;

  // Title and thumbnail generation for each clip
  @Prop({ type: TitleThumbnailGeneration, default: () => ({}) })
  titleThumbnailGeneration: TitleThumbnailGeneration;
}

@Schema({ timestamps: true })
export class Clip {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  // File information
  @Prop({ required: true })
  rawFileUrl: string; // Google Drive URL or file path

  @Prop({ required: true })
  rawFileName: string;

  @Prop({ required: true })
  rawFileSize: number; // In bytes

  @Prop()
  srtFileUrl?: string; // Uploaded SRT file path

  @Prop()
  srtFileName?: string;

  @Prop()
  srtContent?: string; // Raw SRT content

  // AI Configuration
  @Prop({ enum: OpenAIModel, default: OpenAIModel.GPT_4_1_MINI })
  selectedModel: OpenAIModel;

  // Processing status
  @Prop({ enum: ClipStatus, default: ClipStatus.PENDING })
  status: ClipStatus;

  @Prop()
  errorMessage?: string;

  // Theme analysis results
  @Prop({ type: [Theme], default: [] })
  analyzedThemes: Theme[];

  @Prop({ type: Theme })
  selectedTheme?: Theme;

  @Prop({ min: 1, max: 20 })
  requestedClipCount?: number;

  // Generated clips
  @Prop({ type: [GeneratedClip], default: [] })
  generatedClips: GeneratedClip[];

  // Collaborators for this clip project
  @Prop({ type: [Collaborator], default: [] })
  collaborators: Collaborator[];

  // User-defined themes for this project
  @Prop({
    type: [String],
    default: [
      'Action Sequences',
      'Business',
      'Educational',
      'Emotional Moments',
      'Funny Moments',
      'Inspirational',
      'Key Points',
      'Money',
      'Transformation (then vs now)',
      'Vulnerability',
    ],
  })
  themes: string[];

  // Processing timestamps
  @Prop()
  analysisStartedAt?: Date;

  @Prop()
  analysisCompletedAt?: Date;

  @Prop()
  generationStartedAt?: Date;

  @Prop()
  generationCompletedAt?: Date;

  // Metadata
  @Prop({ default: 0 })
  totalDuration: number; // Total video duration in seconds

  @Prop({ default: 0 })
  totalTokensUsed: number; // OpenAI tokens used

  @Prop({ default: 0 })
  estimatedCost: number; // Estimated cost in USD

  @Prop()
  awsFileUrl?: string; // AWS S3 URL for uploaded files

  @Prop()
  completedAt?: Date; // When clip generation completed

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>; // Additional metadata

  @Prop({
    type: {
      uploadSessionId: String,
      bucket: String,
      key: String,
      region: String,
      uploadedAt: Date,
    },
    required: false,
  })
  awsMetadata?: {
    uploadSessionId?: string;
    bucket?: string;
    key?: string;
    region?: string;
    uploadedAt?: Date;
  };

  // Mongoose adds these automatically with timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const ClipSchema = SchemaFactory.createForClass(Clip);

// Add indexes for better query performance
ClipSchema.index({ userId: 1, createdAt: -1 });
ClipSchema.index({ status: 1 });
ClipSchema.index({ createdAt: -1 });
