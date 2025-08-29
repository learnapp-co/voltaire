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

export enum OpenAIModel {
  GPT_4_MINI = 'gpt-4o-mini',
  GPT_4 = 'gpt-4',
  GPT_4_TURBO = 'gpt-4-turbo',
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

  // Voting system for each generated clip
  @Prop({ type: ClipVoting, default: () => ({}) })
  voting: ClipVoting;
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
  @Prop({ enum: OpenAIModel, default: OpenAIModel.GPT_4_MINI })
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
