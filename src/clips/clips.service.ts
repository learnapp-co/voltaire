import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Clip,
  ClipDocument,
  ClipStatus,
  GeneratedClip,
} from '../schemas/clip.schema';
import { VideoProcessingService } from './services/video-processing.service';
import { S3UploadService } from './services/s3-upload.service';
import { CollaboratorService } from './services/collaborator.service';
import {
  ClipProjectResponseDto,
  ClipListResponseDto,
  ClipQueryDto,
  UpdateClipProjectDto,
  GenerateClipsDto,
  ClipGenerationResponseDto,
  RegenerateClipDto,
  GeneratedClipDto,
} from './dto/clips.dto';

@Injectable()
export class ClipsService {
  private readonly logger = new Logger(ClipsService.name);

  constructor(
    @InjectModel(Clip.name) private clipModel: Model<ClipDocument>,
    private videoProcessingService: VideoProcessingService,
    private s3UploadService: S3UploadService,
    private collaboratorService: CollaboratorService,
  ) {}

  /**
   * Create a new clip project
   */
  async createClipProject(data: {
    title: string;
    videoUrl: string;
    srtContent: string;
    srtFileName: string;
    userId: string;
  }): Promise<ClipProjectResponseDto> {
    try {
      this.logger.log(`Creating clip project: ${data.title}`);

      const clip = new this.clipModel({
        title: data.title,
        userId: data.userId,
        rawFileUrl: data.videoUrl,
        rawFileName: this.extractFileNameFromUrl(data.videoUrl),
        rawFileSize: 0,
        srtContent: data.srtContent,
        srtFileName: data.srtFileName,
        status: ClipStatus.PENDING,
        totalDuration: this.calculateDurationFromSrt(data.srtContent),
      });

      const savedClip = await clip.save();
      return this.mapToClipProjectResponse(savedClip);
    } catch (error) {
      this.logger.error('Error creating clip project:', error);
      throw new InternalServerErrorException('Failed to create clip project');
    }
  }

  /**
   * Get all clip projects
   */
  async getClipProjects(
    queryDto: ClipQueryDto,
    userId: string,
  ): Promise<ClipListResponseDto> {
    try {
      const { page = 1, limit = 10 } = queryDto;
      const skip = (page - 1) * limit;

      const query = { userId };
      const total = await this.clipModel.countDocuments(query);

      const clips = await this.clipModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const totalPages = Math.ceil(total / limit);

      return {
        clips: clips.map((clip) => this.mapToClipProjectResponse(clip)),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Error getting clip projects:', error);
      throw new InternalServerErrorException('Failed to get clip projects');
    }
  }

  /**
   * Get clip project by ID
   */
  async getClipProject(
    clipId: string,
    userId: string,
  ): Promise<ClipProjectResponseDto> {
    try {
      const clip = await this.findClipByIdAndUser(clipId, userId);
      return this.mapToClipProjectResponse(clip);
    } catch (error) {
      this.logger.error('Error getting clip project:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get clip project');
    }
  }

  /**
   * Update clip project with generated clips and timestamps
   */
  async updateClipProject(
    clipId: string,
    updateDto: UpdateClipProjectDto,
    userId: string,
  ): Promise<ClipProjectResponseDto> {
    try {
      const clip = await this.findClipByIdAndUser(clipId, userId);

      if (updateDto.title) {
        clip.title = updateDto.title;
      }

      if (updateDto.description) {
        clip.description = updateDto.description;
      }

      if (updateDto.generatedClips) {
        clip.generatedClips = updateDto.generatedClips.map((clipData) => ({
          clipId: clipData.id,
          title: clipData.title,
          startTime: clipData.startTime,
          endTime: clipData.endTime,
          duration: clipData.duration,
          clipUrl: clipData.clipUrl,
          fileSize: clipData.fileSize,
          generatedAt: clipData.generatedAt,
          processingStatus: 'completed',
        })) as GeneratedClip[];
      }

      clip.updatedAt = new Date();
      await clip.save();

      this.logger.log(`Updated clip project: ${clipId}`);
      return this.mapToClipProjectResponse(clip);
    } catch (error) {
      this.logger.error(`Error updating clip project ${clipId}:`, error);
      throw new InternalServerErrorException('Failed to update clip project');
    }
  }

  /**
   * Generate clips based on provided timestamps
   */
  async generateClips(
    clipId: string,
    generateDto: GenerateClipsDto,
    userId: string,
  ): Promise<ClipGenerationResponseDto> {
    try {
      const clip = await this.findClipByIdAndUser(clipId, userId);

      if (!clip.rawFileUrl) {
        throw new BadRequestException(
          'No video file found for clip generation',
        );
      }

      clip.status = ClipStatus.GENERATING;
      clip.generationStartedAt = new Date();
      await clip.save();

      this.logger.log(
        `Generating clips for project ${clipId} with ${generateDto.timestamps.length} clips`,
      );

      // Clear existing clips if regenerating all
      this.logger.log(`🔄 Clearing existing clips for project ${clipId}`);
      clip.generatedClips = [];
      await clip.save();
      this.logger.log(
        `✅ Cleared ${clip.generatedClips.length} existing clips`,
      );

      for (const timestamp of generateDto.timestamps) {
        try {
          this.logger.log(
            `📝 Processing timestamp ${timestamp.id}: ${timestamp.title} (${timestamp.startTime}s-${timestamp.endTime}s)`,
          );

          // First, create the clip in database without video processing
          const generatedClip: GeneratedClip = {
            clipId: timestamp.id,
            title: timestamp.title,
            description: timestamp.description || '',
            transcript: timestamp.description || '',
            hashtags: [],
            startTime: timestamp.startTime,
            endTime: timestamp.endTime,
            duration: timestamp.endTime - timestamp.startTime,
            clipUrl: '', // Will be updated after processing
            fileSize: 0, // Will be updated after processing
            generatedAt: new Date(),
            processingStatus: 'processing',
            voting: {
              shouldThisBePosted: {
                yes: [],
                no: [],
              },
              clipRating: {
                rating1: [],
                rating2: [],
                rating3: [],
                rating4: [],
                rating5: [],
              },
            },
            metadata: {
              quality: generateDto.quality || 'medium',
              format: generateDto.format || 'mp4',
              source: 'user_timestamps',
              originalTimestampId: timestamp.id,
            },
          };

          this.logger.log(`💾 Saving clip ${timestamp.id} to database...`);
          // Add to clips array and save to get MongoDB _id
          clip.generatedClips.push(generatedClip);
          await clip.save();

          // Get the auto-generated MongoDB _id
          const savedClip = clip.generatedClips[clip.generatedClips.length - 1];
          const dbId = (savedClip as any)._id.toString();

          this.logger.log(
            `✅ Created clip in DB with ID ${dbId}, now processing video...`,
          );
          this.logger.log(
            `🎬 Starting video processing for clip ${dbId} using source: ${clip.rawFileUrl}`,
          );

          // Now process video using the database ID for S3 naming
          const clipResult = await this.videoProcessingService.extractClip({
            sourceVideoUrl: clip.rawFileUrl,
            startTime: timestamp.startTime,
            endTime: timestamp.endTime,
            outputFormat: generateDto.format || 'mp4',
            quality: generateDto.quality || 'medium',
            includeFades: false,
            userId: 'default',
            projectId: clipId,
            clipId: dbId, // Use real MongoDB _id for S3 file naming
          });

          this.logger.log(`🎯 Video processing completed for clip ${dbId}`);
          this.logger.log(
            `📊 Result - URL: ${clipResult.clipUrl}, Size: ${clipResult.fileSize} bytes, Duration: ${clipResult.duration}s`,
          );

          // Update the clip with processing results
          savedClip.clipUrl = clipResult.clipUrl;
          savedClip.fileSize = clipResult.fileSize;
          savedClip.processingStatus = 'completed';
          savedClip.generatedAt = new Date();

          this.logger.log(
            `💾 Updating clip ${dbId} in database with results...`,
          );
          await clip.save();

          this.logger.log(
            `✅ Successfully generated clip with DB ID ${dbId} for project ${clipId}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Failed to generate clip ${timestamp.id}:`,
            error,
          );
          this.logger.error(`🔍 Error details: ${error.message}`);

          // Create failed clip in database too
          this.logger.log(
            `💾 Saving failed clip ${timestamp.id} to database...`,
          );
          const failedClip: GeneratedClip = {
            clipId: timestamp.id,
            title: timestamp.title,
            description: timestamp.description || '',
            transcript: timestamp.description || '',
            hashtags: [],
            startTime: timestamp.startTime,
            endTime: timestamp.endTime,
            duration: timestamp.endTime - timestamp.startTime,
            clipUrl: '',
            fileSize: 0,
            generatedAt: new Date(),
            processingStatus: 'failed',
            voting: {
              shouldThisBePosted: {
                yes: [],
                no: [],
              },
              clipRating: {
                rating1: [],
                rating2: [],
                rating3: [],
                rating4: [],
                rating5: [],
              },
            },
            metadata: {
              error: error.message,
              source: 'user_timestamps',
              originalTimestampId: timestamp.id,
            },
          };

          clip.generatedClips.push(failedClip);
          await clip.save();
          this.logger.log(`💾 Saved failed clip ${timestamp.id} to database`);
        }
      }

      // Update project status
      clip.status = ClipStatus.COMPLETED;
      clip.completedAt = new Date();
      await clip.save();

      // Reload clip to get latest data with all _ids
      const updatedClip = await this.findClipById(clipId);

      const successCount = updatedClip.generatedClips.filter(
        (c) => c.processingStatus === 'completed',
      ).length;
      const failureCount = updatedClip.generatedClips.filter(
        (c) => c.processingStatus === 'failed',
      ).length;

      this.logger.log(
        `Clip generation completed for project ${clipId}. Success: ${successCount}, Failed: ${failureCount}`,
      );

      return {
        id: clipId,
        status: ClipStatus.COMPLETED,
        requestedClipCount: generateDto.timestamps.length,
        generatedClips: updatedClip.generatedClips.map((genClip) => ({
          id: genClip.clipId, // Original user-provided ID
          dbId: (genClip as any)._id.toString(), // MongoDB _id for modifications
          title: genClip.title,
          startTime: genClip.startTime,
          endTime: genClip.endTime,
          duration: genClip.duration,
          clipUrl: genClip.clipUrl,
          fileSize: genClip.fileSize,
          generatedAt: genClip.generatedAt,
          processingStatus: genClip.processingStatus,
        })),
        generationCompletedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error generating clips for project ${clipId}:`, error);

      try {
        const clip = await this.findClipById(clipId);
        clip.status = ClipStatus.FAILED;
        await clip.save();
      } catch (updateError) {
        this.logger.error(
          'Failed to update clip status to failed:',
          updateError,
        );
      }

      throw new InternalServerErrorException('Failed to generate clips');
    }
  }

  /**
   * Regenerate a single clip by database ID with modifications
   */
  async regenerateClip(
    clipId: string,
    regenerateDto: RegenerateClipDto,
    userId: string,
  ): Promise<GeneratedClipDto> {
    try {
      const clip = await this.findClipByIdAndUser(clipId, userId);

      if (!clip.rawFileUrl) {
        throw new BadRequestException(
          'No video file found for clip regeneration',
        );
      }

      // Find the existing clip by database ID
      const existingClipIndex = clip.generatedClips.findIndex(
        (genClip) => (genClip as any)._id?.toString() === regenerateDto.dbId,
      );

      if (existingClipIndex === -1) {
        throw new BadRequestException(
          `Clip with database ID ${regenerateDto.dbId} not found`,
        );
      }

      const existingClip = clip.generatedClips[existingClipIndex];

      // Use existing values if not provided in update
      const startTime = regenerateDto.startTime ?? existingClip.startTime;
      const endTime = regenerateDto.endTime ?? existingClip.endTime;
      const title = regenerateDto.title ?? existingClip.title;
      const description = regenerateDto.description ?? existingClip.description;

      this.logger.log(
        `🔄 Regenerating clip ${regenerateDto.dbId} for project ${clipId}`,
      );
      this.logger.log(
        `📋 Original clip: ${existingClip.title} (${existingClip.startTime}s-${existingClip.endTime}s)`,
      );
      this.logger.log(`📋 New params: ${title} (${startTime}s-${endTime}s)`);

      // Use original quality and format from existing clip
      const originalQuality = existingClip.metadata?.quality || 'medium';
      const originalFormat = existingClip.metadata?.format || 'mp4';

      this.logger.log(
        `🎛️ Using original settings - Quality: ${originalQuality}, Format: ${originalFormat}`,
      );
      this.logger.log(
        `🎬 Starting video regeneration for clip ${regenerateDto.dbId} using source: ${clip.rawFileUrl}`,
      );

      // Generate new clip with same database ID (will override in S3)
      const clipResult = await this.videoProcessingService.extractClip({
        sourceVideoUrl: clip.rawFileUrl,
        startTime,
        endTime,
        outputFormat: originalFormat,
        quality: originalQuality,
        includeFades: false,
        userId: 'default',
        projectId: clipId,
        clipId: regenerateDto.dbId, // Use same DB ID to override
      });

      // Update the existing clip in place
      clip.generatedClips[existingClipIndex] = {
        ...existingClip,
        title,
        description,
        startTime,
        endTime,
        duration: endTime - startTime,
        clipUrl: clipResult.clipUrl,
        fileSize: clipResult.fileSize,
        generatedAt: new Date(),
        processingStatus: 'completed',
        metadata: {
          ...existingClip.metadata,
          quality: originalQuality,
          format: originalFormat,
          lastModified: new Date().toISOString(),
        },
      };

      clip.updatedAt = new Date();
      await clip.save();

      this.logger.log(
        `Successfully regenerated clip ${regenerateDto.dbId} for project ${clipId}`,
      );

      return {
        id: existingClip.clipId, // Original user ID
        dbId: regenerateDto.dbId, // Database ID
        title,
        startTime,
        endTime,
        duration: endTime - startTime,
        clipUrl: clipResult.clipUrl,
        fileSize: clipResult.fileSize,
        generatedAt: new Date(),
        processingStatus: 'completed',
      };
    } catch (error) {
      this.logger.error(
        `Error regenerating clip ${regenerateDto.dbId} for project ${clipId}:`,
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to regenerate clip');
    }
  }

  /**
   * Find clip by ID
   */
  private async findClipById(clipId: string): Promise<ClipDocument> {
    const clip = await this.clipModel.findById(clipId);

    if (!clip) {
      throw new NotFoundException('Clip project not found');
    }

    return clip;
  }

  /**
   * Find clip by ID and User (with authorization - includes collaborators)
   */
  private async findClipByIdAndUser(
    clipId: string,
    userId: string,
  ): Promise<ClipDocument> {
    // Use collaborator service to verify access (owner or collaborator)
    await this.collaboratorService.verifyUserAccess(clipId, userId);

    const clip = await this.clipModel.findById(clipId);
    if (!clip) {
      throw new NotFoundException('Clip project not found');
    }

    return clip;
  }

  /**
   * Find clip by ID and Owner (only owner access)
   */
  private async findClipByIdAndOwner(
    clipId: string,
    userId: string,
  ): Promise<ClipDocument> {
    // Use collaborator service to verify owner access
    await this.collaboratorService.verifyUserIsOwner(clipId, userId);

    const clip = await this.clipModel.findById(clipId);
    if (!clip) {
      throw new NotFoundException('Clip project not found');
    }

    return clip;
  }

  /**
   * Extract filename from URL
   */
  private extractFileNameFromUrl(url: string): string {
    try {
      // Use S3UploadService for S3 URLs
      if (this.s3UploadService.isValidS3Url(url)) {
        return this.s3UploadService.extractFileNameFromS3Url(url);
      }

      // For other URLs, extract from path
      const urlParts = url.split('/');
      let fileName = urlParts[urlParts.length - 1] || 'video.mp4';

      // Remove query parameters if present
      if (fileName.includes('?')) {
        fileName = fileName.split('?')[0];
      }

      return fileName;
    } catch {
      return 'video.mp4';
    }
  }

  /**
   * Calculate duration from SRT content
   */
  private calculateDurationFromSrt(srtContent: string): number {
    try {
      const lines = srtContent.split('\n');
      let maxTime = 0;

      for (const line of lines) {
        if (line.includes('-->')) {
          const timeParts = line.split('-->');
          if (timeParts.length === 2) {
            const endTime = timeParts[1].trim();
            const seconds = this.timeStringToSeconds(endTime);
            if (seconds > maxTime) {
              maxTime = seconds;
            }
          }
        }
      }

      return maxTime;
    } catch {
      return 0;
    }
  }

  /**
   * Convert time string to seconds
   */
  private timeStringToSeconds(timeString: string): number {
    try {
      const parts = timeString.split(':');
      if (parts.length !== 3) return 0;

      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const secondsParts = parts[2].split(',');
      const seconds = parseInt(secondsParts[0], 10);

      return hours * 3600 + minutes * 60 + seconds;
    } catch {
      return 0;
    }
  }

  /**
   * Map clip document to response DTO
   */
  private mapToClipProjectResponse(clip: ClipDocument): ClipProjectResponseDto {
    return {
      id: clip._id.toString(),
      title: clip.title,
      description: clip.description,
      status: clip.status,
      rawFile: {
        url: clip.rawFileUrl,
        fileName: clip.rawFileName,
        fileSize: clip.rawFileSize,
      },
      srtFile: clip.srtFileName
        ? {
            fileName: clip.srtFileName,
            url: `/uploads/srt/${clip.srtFileName}`,
          }
        : undefined,
      totalDuration: clip.totalDuration,
      createdAt: clip.createdAt!,
      updatedAt: clip.updatedAt!,
    };
  }
}
