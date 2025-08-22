import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface ChunkInfo {
  chunkNumber: number;
  eTag: string;
  size: number;
  uploadedAt: Date;
  isCompleted: boolean;
}

export enum UploadSessionStatus {
  INITIALIZING = 'initializing',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABORTED = 'aborted',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true })
export class UploadSession extends Document {
  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  fileType: string;

  @Prop({ required: true })
  totalChunks: number;

  @Prop({ required: true })
  chunkSize: number;

  @Prop({ required: true })
  uploadId: string; // S3 multipart upload ID

  @Prop({ required: true })
  bucket: string;

  @Prop({ required: true })
  key: string;

  @Prop({
    type: [
      {
        chunkNumber: { type: Number, required: true },
        eTag: { type: String, default: '' },
        size: { type: Number, default: 0 },
        uploadedAt: { type: Date },
        isCompleted: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  chunks: ChunkInfo[];

  @Prop({
    type: String,
    enum: Object.values(UploadSessionStatus),
    default: UploadSessionStatus.INITIALIZING,
  })
  status: UploadSessionStatus;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  finalFileUrl?: string;

  @Prop()
  errorMessage?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UploadSessionSchema = SchemaFactory.createForClass(UploadSession);

// Add indexes for better query performance
UploadSessionSchema.index({ sessionId: 1 });
UploadSessionSchema.index({ userId: 1 });
UploadSessionSchema.index({ status: 1 });
UploadSessionSchema.index({ expiresAt: 1 });
UploadSessionSchema.index({ createdAt: -1 });
