import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  UploadSession,
  UploadSessionStatus,
  ChunkInfo,
} from '../../schemas/upload-session.schema';

export interface CreateUploadSessionData {
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  totalChunks: number;
  chunkSize: number;
  uploadId: string;
  bucket: string;
  key: string;
  metadata?: Record<string, any>;
  expiresIn?: number; // in seconds, default 24 hours
}

export interface UploadProgressInfo {
  sessionId: string;
  status: UploadSessionStatus;
  totalChunks: number;
  completedChunks: number;
  progressPercentage: number;
  totalFileSize: number;
  uploadedSize: number;
  chunks: ChunkInfo[];
  finalFileUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

@Injectable()
export class UploadSessionService {
  private readonly logger = new Logger(UploadSessionService.name);

  constructor(
    @InjectModel(UploadSession.name)
    private readonly uploadSessionModel: Model<UploadSession>,
  ) {}

  /**
   * Create a new upload session
   */
  async createUploadSession(
    data: CreateUploadSessionData,
  ): Promise<UploadSession> {
    const sessionId = `session_${uuidv4()}`;
    const expiresAt = new Date(Date.now() + (data.expiresIn || 86400) * 1000); // 24 hours default

    // Initialize chunks array
    const chunks: ChunkInfo[] = [];
    for (let i = 1; i <= data.totalChunks; i++) {
      chunks.push({
        chunkNumber: i,
        eTag: '',
        size: 0,
        uploadedAt: new Date(),
        isCompleted: false,
      });
    }

    const uploadSession = new this.uploadSessionModel({
      sessionId,
      userId: data.userId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      fileType: data.fileType,
      totalChunks: data.totalChunks,
      chunkSize: data.chunkSize,
      uploadId: data.uploadId,
      bucket: data.bucket,
      key: data.key,
      chunks,
      status: UploadSessionStatus.INITIALIZING,
      expiresAt,
      metadata: data.metadata,
    });

    const savedSession = await uploadSession.save();
    this.logger.log(
      `Created upload session: ${sessionId} for user: ${data.userId}`,
    );

    return savedSession;
  }

  /**
   * Get upload session by session ID
   */
  async getUploadSession(sessionId: string): Promise<UploadSession> {
    const session = await this.uploadSessionModel.findOne({ sessionId }).exec();

    if (!session) {
      throw new NotFoundException(`Upload session not found: ${sessionId}`);
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      await this.markSessionAsExpired(sessionId);
      throw new BadRequestException(`Upload session has expired: ${sessionId}`);
    }

    return session;
  }

  /**
   * Update upload session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: UploadSessionStatus,
    errorMessage?: string,
  ): Promise<UploadSession> {
    const updateData: any = { status };

    if (status === UploadSessionStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    const session = await this.uploadSessionModel
      .findOneAndUpdate({ sessionId }, updateData, { new: true })
      .exec();

    if (!session) {
      throw new NotFoundException(`Upload session not found: ${sessionId}`);
    }

    this.logger.log(`Updated session ${sessionId} status to: ${status}`);
    return session;
  }

  /**
   * Update chunk status
   */
  async updateChunkStatus(
    sessionId: string,
    chunkNumber: number,
    eTag: string,
    size: number,
  ): Promise<UploadSession> {
    const session = await this.getUploadSession(sessionId);

    // Validate chunk number
    if (chunkNumber < 1 || chunkNumber > session.totalChunks) {
      throw new BadRequestException(
        `Invalid chunk number: ${chunkNumber}. Must be between 1 and ${session.totalChunks}`,
      );
    }

    // Find and update the chunk
    const chunkIndex = chunkNumber - 1;
    if (session.chunks[chunkIndex]) {
      session.chunks[chunkIndex].eTag = eTag;
      session.chunks[chunkIndex].size = size;
      session.chunks[chunkIndex].uploadedAt = new Date();
      session.chunks[chunkIndex].isCompleted = true;
    }

    // Update session status if needed
    const completedChunks = session.chunks.filter(
      (chunk) => chunk.isCompleted,
    ).length;
    if (completedChunks === session.totalChunks) {
      session.status = UploadSessionStatus.UPLOADING; // Ready for completion
    } else if (session.status === UploadSessionStatus.INITIALIZING) {
      session.status = UploadSessionStatus.UPLOADING;
    }

    const updatedSession = await session.save();

    this.logger.log(
      `Updated chunk ${chunkNumber} for session ${sessionId}. Progress: ${completedChunks}/${session.totalChunks}`,
    );

    return updatedSession;
  }

  /**
   * Mark upload session as completed
   */
  async completeUploadSession(
    sessionId: string,
    finalFileUrl: string,
  ): Promise<UploadSession> {
    const session = await this.uploadSessionModel
      .findOneAndUpdate(
        { sessionId },
        {
          status: UploadSessionStatus.COMPLETED,
          finalFileUrl,
          completedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!session) {
      throw new NotFoundException(`Upload session not found: ${sessionId}`);
    }

    this.logger.log(`Completed upload session: ${sessionId}`);
    return session;
  }

  /**
   * Abort upload session
   */
  async abortUploadSession(
    sessionId: string,
    reason?: string,
  ): Promise<UploadSession> {
    const session = await this.uploadSessionModel
      .findOneAndUpdate(
        { sessionId },
        {
          status: UploadSessionStatus.ABORTED,
          errorMessage: reason || 'Upload aborted by user',
        },
        { new: true },
      )
      .exec();

    if (!session) {
      throw new NotFoundException(`Upload session not found: ${sessionId}`);
    }

    this.logger.log(
      `Aborted upload session: ${sessionId}. Reason: ${reason || 'User requested'}`,
    );
    return session;
  }

  /**
   * Mark session as expired
   */
  async markSessionAsExpired(sessionId: string): Promise<void> {
    await this.uploadSessionModel
      .updateOne({ sessionId }, { status: UploadSessionStatus.EXPIRED })
      .exec();

    this.logger.log(`Marked session as expired: ${sessionId}`);
  }

  /**
   * Get upload progress information
   */
  async getUploadProgress(sessionId: string): Promise<UploadProgressInfo> {
    const session = await this.getUploadSession(sessionId);

    const completedChunks = session.chunks.filter(
      (chunk) => chunk.isCompleted,
    ).length;
    const uploadedSize = session.chunks
      .filter((chunk) => chunk.isCompleted)
      .reduce((total, chunk) => total + chunk.size, 0);

    const progressPercentage = Math.round(
      (uploadedSize / session.fileSize) * 100,
    );

    return {
      sessionId: session.sessionId,
      status: session.status,
      totalChunks: session.totalChunks,
      completedChunks,
      progressPercentage,
      totalFileSize: session.fileSize,
      uploadedSize,
      chunks: session.chunks,
      finalFileUrl: session.finalFileUrl,
      errorMessage: session.errorMessage,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Get upload sessions for a user
   */
  async getUserUploadSessions(
    userId: string,
    status?: UploadSessionStatus,
    limit: number = 20,
    offset: number = 0,
  ): Promise<UploadSession[]> {
    const query: any = { userId };

    if (status) {
      query.status = status;
    }

    return this.uploadSessionModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  /**
   * Get chunk parts for multipart upload completion
   */
  getCompletedChunkParts(
    session: UploadSession,
  ): Array<{ PartNumber: number; ETag: string }> {
    return session.chunks
      .filter((chunk) => chunk.isCompleted && chunk.eTag)
      .map((chunk) => ({
        PartNumber: chunk.chunkNumber,
        ETag: chunk.eTag,
      }))
      .sort((a, b) => a.PartNumber - b.PartNumber);
  }

  /**
   * Validate all chunks are uploaded
   */
  validateAllChunksUploaded(session: UploadSession): boolean {
    return session.chunks.every((chunk) => chunk.isCompleted && chunk.eTag);
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.uploadSessionModel
      .updateMany(
        {
          expiresAt: { $lt: new Date() },
          status: {
            $nin: [UploadSessionStatus.COMPLETED, UploadSessionStatus.EXPIRED],
          },
        },
        { status: UploadSessionStatus.EXPIRED },
      )
      .exec();

    this.logger.log(`Marked ${result.modifiedCount} sessions as expired`);
    return result.modifiedCount;
  }

  /**
   * Delete old completed/expired sessions
   */
  async deleteOldSessions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.uploadSessionModel
      .deleteMany({
        createdAt: { $lt: cutoffDate },
        status: {
          $in: [
            UploadSessionStatus.COMPLETED,
            UploadSessionStatus.EXPIRED,
            UploadSessionStatus.ABORTED,
          ],
        },
      })
      .exec();

    this.logger.log(`Deleted ${result.deletedCount} old upload sessions`);
    return result.deletedCount;
  }
}
