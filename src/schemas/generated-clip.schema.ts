import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AIModel } from './clip.schema';

export type GeneratedClipDocument = GeneratedClip & Document;

export enum GeneratedClipStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DISCARDED = 'discarded',
}

// Predefined themes (can be extended)
export enum PredefinedTheme {
  MONEY_FAME_INDUSTRY_TRUTHS = 'Money, fame, or industry truths',
  FIRSTS_AND_BREAKTHROUGHS = 'Firsts and breakthroughs (first paycheck, big break, first failure)',
  VULNERABILITY = 'Vulnerability (burnout, fear, comparison, loneliness)',
  TRANSFORMATION = 'Transformation (then vs now)',
  HACKS_OR_LESSONS = 'Hacks or hard-earned lessons',
  BREAKING_STEREOTYPES = 'Breaking stereotypes or taboos',
}

@Schema()
export class TimeStamp {
  @Prop({ required: true })
  startTime: number; // In seconds

  @Prop({ required: true })
  endTime: number; // In seconds

  @Prop({ required: true })
  duration: number; // In seconds (endTime - startTime)
}

@Schema()
export class ClipSegment {
  @Prop({ required: true })
  startTime: string; // In HH:MM:SS,mmm format

  @Prop({ required: true })
  endTime: string; // In HH:MM:SS,mmm format

  @Prop({ required: true })
  duration: number; // In seconds (calculated from timestamps)

  @Prop({ enum: ['hook', 'build', 'payoff'], required: true })
  purpose: string; // Narrative purpose: hook, build, or payoff

  @Prop({ default: 1 })
  sequenceOrder: number; // Order within the Franken-Clip (1, 2, 3, 4)
}

@Schema()
export class AIMetadata {
  @Prop({ required: true })
  confidence: number; // AI confidence score 0-1

  @Prop({ type: [String], default: [] })
  keywords: string[]; // AI extracted keywords

  @Prop()
  reasoning?: string; // AI's reasoning for this clip

  @Prop({ type: [String], default: [] })
  hashtags: string[]; // AI suggested hashtags
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

  @Prop({ enum: AIModel, default: AIModel.GPT_4O_MINI })
  selectedAIModel: AIModel;

  @Prop({ type: TitleVoting, default: () => ({}) })
  titleVoting: TitleVoting;

  @Prop({ type: ThumbnailVoting, default: () => ({}) })
  thumbnailVoting: ThumbnailVoting;

  @Prop({ default: false })
  isComplete: boolean; // True when both title and thumbnail are saved
}

@Schema({ timestamps: true })
export class GeneratedClip {
  @Prop({ type: Types.ObjectId, ref: 'Clip', required: true })
  projectId: Types.ObjectId; // Reference to main clip project

  @Prop({ required: true })
  theme: string; // Theme name (predefined or custom)

  @Prop({ default: false })
  isCustomTheme: boolean; // True if user provided custom theme

  @Prop({ required: true })
  generationId: string; // UUID to group clips from same generation batch

  @Prop({ required: true })
  clipSequence: number; // 1-20, sequence number within the theme

  // AI Generated Content
  @Prop({ required: true })
  title: string; // AI generated title

  @Prop({ required: true })
  description: string; // AI generated description

  @Prop({ type: TimeStamp, required: true })
  timeStamp: TimeStamp; // AI suggested timestamps (for single segment clips)

  @Prop({ type: [ClipSegment], default: [] })
  segments: ClipSegment[]; // For Franken-Clips with multiple non-contiguous segments

  @Prop()
  totalDuration?: number; // Total combined duration for Franken-Clips

  @Prop({ default: false })
  isFrankenClip: boolean; // True if this is a multi-segment Franken-Clip

  @Prop()
  transcript: string; // Transcript for this specific clip segment

  @Prop({ type: AIMetadata, required: true })
  aiMetadata: AIMetadata;

  // Generated Video Information
  @Prop()
  videoUrl?: string; // AWS S3 URL of generated clip

  @Prop()
  rawClipUrl?: string; // Raw clip URL (for direct access)

  @Prop()
  fileName?: string; // Generated clip filename

  @Prop()
  fileSize?: number; // File size in bytes

  @Prop({
    enum: GeneratedClipStatus,
    default: GeneratedClipStatus.PENDING,
  })
  status: GeneratedClipStatus;

  @Prop()
  processingError?: string; // Error message if processing failed

  // User Interactions
  @Prop({ default: false })
  isLiked: boolean; // User liked this clip

  @Prop({ default: false })
  isBookmarked: boolean; // User bookmarked for later

  @Prop({ default: 0 })
  viewCount: number; // How many times viewed

  // Archive functionality
  @Prop({ default: false })
  isArchived: boolean; // Whether this clip is archived

  @Prop()
  archivedAt?: Date; // When the clip was archived

  @Prop({ type: Types.ObjectId, ref: 'User' })
  archivedBy?: Types.ObjectId; // Who archived the clip

  // Refinement History
  @Prop({ type: [TimeStamp], default: [] })
  refinementHistory: TimeStamp[]; // History of user timestamp adjustments

  @Prop()
  originalTimeStamp?: TimeStamp; // Original AI suggested timestamp (before refinements)

  // AWS Storage Information
  @Prop({
    type: {
      bucket: String,
      key: String,
      region: String,
      uploadedAt: Date,
    },
    required: false,
  })
  awsMetadata?: {
    bucket?: string;
    key?: string;
    region?: string;
    uploadedAt?: Date;
  };

  // Processing Timestamps
  @Prop()
  generatedAt?: Date; // When AI generated this clip metadata

  @Prop()
  processingStartedAt?: Date; // When video processing started

  @Prop()
  processingCompletedAt?: Date; // When video processing completed

  @Prop()
  lastRefinedAt?: Date; // Last time user refined this clip

  // Title and Thumbnail Generation
  @Prop({ type: TitleThumbnailGeneration, default: () => ({}) })
  titleThumbnailGeneration: TitleThumbnailGeneration;

  // Additional Metadata
  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>; // Additional flexible metadata

  // Mongoose adds these automatically with timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const GeneratedClipSchema = SchemaFactory.createForClass(GeneratedClip);

// Add indexes for better query performance
GeneratedClipSchema.index({ projectId: 1, theme: 1 });
GeneratedClipSchema.index({ projectId: 1, generationId: 1 });
GeneratedClipSchema.index({ projectId: 1, status: 1 });
GeneratedClipSchema.index({ theme: 1, createdAt: -1 });
GeneratedClipSchema.index({ status: 1, createdAt: -1 });
GeneratedClipSchema.index({ generationId: 1, clipSequence: 1 });
