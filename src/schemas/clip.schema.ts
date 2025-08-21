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

  @Prop({ required: true })
  srtFileUrl: string; // Uploaded SRT file path

  @Prop({ required: true })
  srtFileName: string;

  @Prop({ required: true })
  srtContent: string; // Raw SRT content

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

  // Mongoose adds these automatically with timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const ClipSchema = SchemaFactory.createForClass(Clip);

// Add indexes for better query performance
ClipSchema.index({ userId: 1, createdAt: -1 });
ClipSchema.index({ status: 1 });
ClipSchema.index({ createdAt: -1 });
