import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  GeneratedClip,
  GeneratedClipDocument,
  GeneratedClipStatus,
} from '../../schemas/generated-clip.schema';
import { Clip, ClipDocument } from '../../schemas/clip.schema';
import { VideoProcessingService } from './video-processing.service';
import {
  AIClipGenerationService,
  ThemeGenerationRequest,
} from './ai-clip-generation.service';
import { EditAIClipRequestDto, ArchivedClipsQueryDto } from '../dto/clips.dto';

export interface ClipProcessingOptions {
  quality?: 'low' | 'medium' | 'high';
  format?: string;
  includeFades?: boolean;
}

export interface ProcessedClipResult {
  clipId: string;
  title: string;
  description: string;
  videoUrl: string;
  fileSize: number;
  duration: number;
  status: GeneratedClipStatus;
  processingError?: string;
}

export interface BatchProcessingResult {
  generationId: string;
  theme: string;
  totalClips: number;
  processedClips: number;
  failedClips: number;
  results: ProcessedClipResult[];
}

@Injectable()
export class ClipProcessingService {
  private readonly logger = new Logger(ClipProcessingService.name);

  constructor(
    @InjectModel(GeneratedClip.name)
    private generatedClipModel: Model<GeneratedClipDocument>,
    @InjectModel(Clip.name)
    private clipModel: Model<ClipDocument>,
    private videoProcessingService: VideoProcessingService,
    private aiClipGenerationService: AIClipGenerationService,
  ) {}

  /**
   * Complete workflow: AI generation + video processing
   */
  async generateAndProcessClipsForTheme(
    request: ThemeGenerationRequest,
    srtContent: string,
    processingOptions: ClipProcessingOptions = {},
  ): Promise<BatchProcessingResult> {
    try {
      this.logger.log(
        `Starting complete clip generation workflow for theme: ${request.theme}`,
      );

      // Step 1: Get the main clip project to access raw video URL
      const clipProject = await this.clipModel
        .findById(request.projectId)
        .exec();
      if (!clipProject) {
        throw new BadRequestException('Clip project not found');
      }

      if (!clipProject.rawFileUrl) {
        throw new BadRequestException(
          'Raw video file URL not found in project',
        );
      }

      // Step 2: Generate AI clips metadata
      this.logger.log('Generating AI clip metadata...');

      const aiResult = await this.aiClipGenerationService.generateClipsForTheme(
        request,
        srtContent,
      );

      const batchResult = await this.processClipsBatch(
        aiResult.generationId,
        clipProject.rawFileUrl,
        clipProject.userId.toString(),
        request.projectId,
        processingOptions,
      );

      return batchResult;
    } catch (error) {
      this.logger.error(`Error in complete clip generation workflow:`, error);
      throw error;
    }
  }
  /**
   * Get all processed clips for a project grouped by theme
   */
  async getProcessedClipsByProject(projectId: string): Promise<{
    [theme: string]: GeneratedClip[];
  }> {
    const clips = await this.generatedClipModel
      .find({
        projectId,
        status: { $ne: GeneratedClipStatus.DISCARDED },
      })
      .sort({ theme: 1, clipSequence: 1 })
      .exec();

    // Group by theme
    const clipsByTheme: { [theme: string]: GeneratedClip[] } = {};
    for (const clip of clips) {
      if (!clipsByTheme[clip.theme]) {
        clipsByTheme[clip.theme] = [];
      }
      clipsByTheme[clip.theme].push(clip);
    }

    return clipsByTheme;
  }

  /**
   * Get clips for a specific theme
   */
  async getClipsByTheme(
    projectId: string,
    theme: string,
  ): Promise<GeneratedClip[]> {
    return await this.aiClipGenerationService.getClipsByTheme(projectId, theme);
  }

  /**
   * Private helper methods
   */

  /**
   * Process a batch of generated clips into video files
   */
  private async processClipsBatch(
    generationId: string,
    rawVideoUrl: string,
    userId: string,
    projectId: string,
    processingOptions: ClipProcessingOptions,
  ): Promise<BatchProcessingResult> {
    // Get all clips for this generation
    const clips = await this.generatedClipModel
      .find({ generationId })
      .sort({ clipSequence: 1 })
      .exec();

    if (clips.length === 0) {
      throw new BadRequestException('No clips found for generation');
    }

    const results: ProcessedClipResult[] = [];
    let processedCount = 0;
    let failedCount = 0;

    // Process clips sequentially to avoid overwhelming the system
    for (const clip of clips) {
      try {
        this.logger.log(
          `Processing clip ${clip.clipSequence}/${clips.length}: ${clip.title}`,
        );

        const result = await this.processSingleClip(
          clip,
          rawVideoUrl,
          userId,
          projectId,
          processingOptions,
        );

        results.push(result);
        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process clip ${(clip as any)._id}:`,
          error,
        );

        // Update clip status to failed
        await this.updateClipStatus(
          (clip as any)._id.toString(),
          GeneratedClipStatus.FAILED,
          error.message,
        );

        results.push({
          clipId: (clip as any)._id.toString(),
          title: clip.title,
          description: clip.description,
          videoUrl: '',
          fileSize: 0,
          duration: clip.timeStamp.duration,
          status: GeneratedClipStatus.FAILED,
          processingError: error.message,
        });

        failedCount++;
      }
    }

    this.logger.log(
      `Batch processing completed. Processed: ${processedCount}, Failed: ${failedCount}, Total: ${clips.length}`,
    );

    return {
      generationId,
      theme: clips[0].theme,
      totalClips: clips.length,
      processedClips: processedCount,
      failedClips: failedCount,
      results,
    };
  }

  /**
   * Process a single clip into a video file
   */
  private async processSingleClip(
    clip: GeneratedClip,
    rawVideoUrl: string,
    userId: string,
    projectId: string,
    processingOptions: ClipProcessingOptions,
  ): Promise<ProcessedClipResult> {
    try {
      // Update status to processing
      await this.updateClipStatus(
        (clip as any)._id.toString(),
        GeneratedClipStatus.PROCESSING,
      );

      let extractResult;

      // Check if this is a Franken-Clip with multiple segments
      if (clip.isFrankenClip && clip.segments && clip.segments.length > 0) {
        this.logger.log(
          `Processing Franken-Clip with ${clip.segments.length} segments: ${clip.title}`,
        );

        // Extract and stitch multiple segments
        extractResult =
          await this.videoProcessingService.extractAndStitchSegments({
            sourceVideoUrl: rawVideoUrl,
            segments: clip.segments.map((segment) => ({
              startTime: this.srtToSeconds(segment.startTime),
              endTime: this.srtToSeconds(segment.endTime),
              duration: segment.duration,
              purpose: segment.purpose,
              sequenceOrder: segment.sequenceOrder,
            })),
            outputFormat: processingOptions.format || 'mp4',
            quality: processingOptions.quality || 'low',
            includeFades: processingOptions.includeFades || false,
            userId,
            projectId,
            clipId: (clip as any)._id.toString(),
          });

        this.logger.log(
          `Successfully processed Franken-Clip with total duration: ${extractResult.duration}s`,
        );
      } else {
        // Process single segment clip
        this.logger.log(`Processing single segment clip: ${clip.title}`);

        extractResult = await this.videoProcessingService.extractClip({
          sourceVideoUrl: rawVideoUrl,
          startTime: clip.timeStamp.startTime,
          endTime: clip.timeStamp.endTime,
          outputFormat: processingOptions.format || 'mp4',
          quality: processingOptions.quality || 'low',
          includeFades: processingOptions.includeFades || false,
          userId,
          projectId,
          clipId: (clip as any)._id.toString(),
        });
      }

      // Update clip with video URL and status
      const updateData: any = {
        videoUrl: extractResult.clipUrl,
        fileName: `${clip.title.substring(0, 20)}_${(clip as any)._id}.${processingOptions.format || 'mp4'}`,
        fileSize: extractResult.fileSize,
        status: GeneratedClipStatus.COMPLETED,
        processingCompletedAt: new Date(),
        awsMetadata: {
          uploadedAt: extractResult.processedAt,
        },
      };

      // For Franken-Clips, update the total duration
      if (clip.isFrankenClip) {
        updateData.totalDuration = extractResult.duration;
      }

      await this.generatedClipModel
        .findByIdAndUpdate((clip as any)._id, updateData, { new: true })
        .exec();

      this.logger.log(`Successfully processed clip: ${clip.title}`);

      return {
        clipId: (clip as any)._id.toString(),
        title: clip.title,
        description: clip.description,
        videoUrl: extractResult.clipUrl,
        fileSize: extractResult.fileSize,
        duration: extractResult.duration,
        status: GeneratedClipStatus.COMPLETED,
      };
    } catch (error) {
      // Update status to failed
      await this.updateClipStatus(
        (clip as any)._id.toString(),
        GeneratedClipStatus.FAILED,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get AI-generated clip by ID for editing
   */
  async getAIClipById(
    projectId: string,
    clipId: string,
  ): Promise<GeneratedClipDocument> {
    const clip = await this.generatedClipModel
      .findOne({
        _id: clipId,
        projectId,
      })
      .exec();

    if (!clip) {
      throw new NotFoundException(
        `AI-generated clip with ID ${clipId} not found in project ${projectId}`,
      );
    }

    return clip;
  }

  /**
   * Edit AI-generated clip with new segments and regenerate video
   */
  async editAIClip(
    projectId: string,
    clipId: string,
    editRequest: EditAIClipRequestDto,
  ): Promise<GeneratedClipDocument> {
    this.logger.log(`Editing AI clip ${clipId} in project ${projectId}`);

    // Get the existing clip
    const existingClip = await this.getAIClipById(projectId, clipId);

    // Validate edit request
    this.validateEditRequest(editRequest);

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
      lastRefinedAt: new Date(),
    };

    // Update title and description if provided
    if (editRequest.title) {
      updateData.title = editRequest.title;
    }
    if (editRequest.description) {
      updateData.description = editRequest.description;
    }

    // Handle segment updates
    if (editRequest.segments && editRequest.segments.length > 0) {
      // Store original timestamp in refinement history if not already stored
      if (existingClip.originalTimeStamp === undefined) {
        updateData.originalTimeStamp = existingClip.timeStamp;
      }

      // Add current timestamp to refinement history
      const refinementHistory = [...(existingClip.refinementHistory || [])];
      if (existingClip.timeStamp) {
        refinementHistory.push(existingClip.timeStamp);
      }
      updateData.refinementHistory = refinementHistory;

      // Convert edit segments to proper format
      const segments = editRequest.segments.map((segment, index) => {
        // Calculate duration in seconds for database storage
        const startSeconds = this.srtToSeconds(segment.startTime);
        const endSeconds = this.srtToSeconds(segment.endTime);

        return {
          startTime: segment.startTime, // Keep in HH:MM:SS,mmm format
          endTime: segment.endTime, // Keep in HH:MM:SS,mmm format
          duration: endSeconds - startSeconds, // Store duration in seconds
          purpose: segment.purpose || `Segment ${index + 1}`,
          sequenceOrder: segment.sequenceOrder || index + 1,
        };
      });

      updateData.segments = segments;

      // Calculate total duration
      const totalDuration = segments.reduce(
        (sum, segment) => sum + segment.duration,
        0,
      );
      updateData.totalDuration = totalDuration;

      // Update main timestamp for backward compatibility (use first segment)
      if (segments.length > 0) {
        updateData.timeStamp = {
          startTime: segments[0].startTime,
          endTime: segments[0].endTime,
          duration: segments[0].duration,
        };
      }

      // Mark as Franken-Clip if multiple segments
      updateData.isFrankenClip = segments.length > 1;
    }

    // Update the clip in database
    const updatedClip = await this.generatedClipModel
      .findByIdAndUpdate(clipId, updateData, { new: true })
      .exec();

    if (!updatedClip) {
      throw new NotFoundException(`Failed to update clip ${clipId}`);
    }

    // Regenerate video if requested
    if (editRequest.regenerateVideo !== false) {
      await this.regenerateEditedClip(updatedClip);

      // Fetch the updated clip with the latest status after regeneration
      const finalClip = await this.generatedClipModel.findById(clipId).exec();
      return finalClip || updatedClip;
    }

    return updatedClip;
  }

  /**
   * Regenerate video for edited clip
   */
  private async regenerateEditedClip(
    clip: GeneratedClipDocument,
  ): Promise<void> {
    this.logger.log(`Regenerating video for edited clip ${clip._id}`);

    try {
      // Update status to processing
      await this.updateClipStatus(
        clip._id.toString(),
        GeneratedClipStatus.PROCESSING,
      );

      // Get the original project to access source video
      const project = await this.clipModel.findById(clip.projectId).exec();
      if (!project) {
        throw new NotFoundException(`Project ${clip.projectId} not found`);
      }

      // Extract segments and create the video
      if (clip.isFrankenClip && clip.segments && clip.segments.length > 1) {
        // Handle Franken-Clip with multiple segments
        await this.createFrankenClipVideo(clip, project);
      } else {
        // Handle single segment clip
        await this.createSingleSegmentVideo(clip, project);
      }

      this.logger.log(`Successfully regenerated video for clip ${clip._id}`);
    } catch (error) {
      this.logger.error(
        `Failed to regenerate video for clip ${clip._id}:`,
        error,
      );
      await this.updateClipStatus(
        clip._id.toString(),
        GeneratedClipStatus.FAILED,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Create video for single segment clip
   */
  private async createSingleSegmentVideo(
    clip: GeneratedClipDocument,
    project: ClipDocument,
  ): Promise<void> {
    const startTime = clip.timeStamp?.startTime || 0;
    const duration = clip.timeStamp?.duration || 30;

    const result = await this.videoProcessingService.extractClip({
      sourceVideoUrl: project.rawFileUrl,
      projectId: project._id.toString(),
      clipId: clip._id.toString(),
      startTime,
      endTime: startTime + duration,
      quality: 'medium',
      includeFades: true,
      userId: '', // TODO: Add userId parameter to this method
    });

    // Update clip with new video URL and metadata
    await this.generatedClipModel
      .findByIdAndUpdate(clip._id, {
        videoUrl: result.clipUrl,
        fileSize: result.fileSize,
        status: GeneratedClipStatus.COMPLETED,
        processingCompletedAt: new Date(),
      })
      .exec();
  }

  /**
   * Create video for Franken-Clip with multiple segments
   */
  private async createFrankenClipVideo(
    clip: GeneratedClipDocument,
    project: ClipDocument,
  ): Promise<void> {
    // Extract each segment separately
    const segmentPromises = clip.segments.map(async (segment, index) => {
      const tempClipId = `${clip._id}_segment_${index}`;

      return this.videoProcessingService.extractClip({
        sourceVideoUrl: project.rawFileUrl,
        projectId: project._id.toString(),
        clipId: tempClipId,
        startTime: this.srtToSeconds(segment.startTime),
        endTime: this.srtToSeconds(segment.endTime),
        quality: 'medium',
        includeFades: false, // We'll handle transitions in the merge
        userId: '', // TODO: Add userId parameter to this method
      });
    });

    const segmentResults = await Promise.all(segmentPromises);

    // TODO: Implement video segment merging
    // For now, use the first segment as the result
    // In a full implementation, you would merge all segments into one video
    const primaryResult = segmentResults[0];

    // Update clip with new video URL and metadata
    await this.generatedClipModel
      .findByIdAndUpdate(clip._id, {
        videoUrl: primaryResult.clipUrl,
        fileSize: primaryResult.fileSize,
        status: GeneratedClipStatus.COMPLETED,
        processingCompletedAt: new Date(),
      })
      .exec();

    this.logger.warn(
      `Franken-Clip merging not yet implemented. Using first segment only.`,
    );
  }

  /**
   * Validate edit request data
   */
  private validateEditRequest(editRequest: EditAIClipRequestDto): void {
    if (editRequest.segments) {
      for (let i = 0; i < editRequest.segments.length; i++) {
        const segment = editRequest.segments[i];

        // Validate segment duration
        const startSeconds = this.srtToSeconds(segment.startTime);
        const endSeconds = this.srtToSeconds(segment.endTime);
        const duration = endSeconds - startSeconds;
        if (duration <= 0) {
          throw new BadRequestException(
            `Segment ${i + 1}: End time must be greater than start time`,
          );
        }

        if (duration < 1) {
          throw new BadRequestException(
            `Segment ${i + 1}: Duration must be at least 1 second`,
          );
        }

        if (duration > 300) {
          // 5 minutes max per segment
          throw new BadRequestException(
            `Segment ${i + 1}: Duration cannot exceed 300 seconds`,
          );
        }

        // Validate start time
        if (startSeconds < 0) {
          throw new BadRequestException(
            `Segment ${i + 1}: Start time cannot be negative`,
          );
        }
      }

      // Validate total duration
      const totalDuration = editRequest.segments.reduce((sum, segment) => {
        const startSeconds = this.srtToSeconds(segment.startTime);
        const endSeconds = this.srtToSeconds(segment.endTime);
        return sum + (endSeconds - startSeconds);
      }, 0);

      if (totalDuration > 600) {
        // 10 minutes max total
        throw new BadRequestException(
          `Total duration of all segments cannot exceed 600 seconds (10 minutes)`,
        );
      }
    }
  }

  /**
   * Archive an AI-generated clip
   */
  async archiveAIClip(
    projectId: string,
    clipId: string,
    userId: string,
  ): Promise<GeneratedClipDocument> {
    this.logger.log(
      `Archiving AI clip ${clipId} in project ${projectId} by user ${userId}`,
    );

    const clip = await this.getAIClipById(projectId, clipId);

    if (clip.isArchived) {
      throw new BadRequestException('Clip is already archived');
    }

    const updatedClip = await this.generatedClipModel
      .findByIdAndUpdate(
        clipId,
        {
          isArchived: true,
          archivedAt: new Date(),
          archivedBy: userId,
          updatedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!updatedClip) {
      throw new NotFoundException(`Failed to archive clip ${clipId}`);
    }

    this.logger.log(`Successfully archived AI clip ${clipId}`);
    return updatedClip;
  }

  /**
   * Unarchive an AI-generated clip
   */
  async unarchiveAIClip(
    projectId: string,
    clipId: string,
  ): Promise<GeneratedClipDocument> {
    this.logger.log(`Unarchiving AI clip ${clipId} in project ${projectId}`);

    const clip = await this.getAIClipById(projectId, clipId);

    if (!clip.isArchived) {
      throw new BadRequestException('Clip is not archived');
    }

    const updatedClip = await this.generatedClipModel
      .findByIdAndUpdate(
        clipId,
        {
          isArchived: false,
          archivedAt: undefined,
          archivedBy: undefined,
          updatedAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!updatedClip) {
      throw new NotFoundException(`Failed to unarchive clip ${clipId}`);
    }

    this.logger.log(`Successfully unarchived AI clip ${clipId}`);
    return updatedClip;
  }

  /**
   * Get archived clips for a project with filtering and pagination
   */
  async getArchivedClips(
    projectId: string,
    query: ArchivedClipsQueryDto = {},
  ): Promise<{
    clips: GeneratedClipDocument[];
    totalClips: number;
    currentPage: number;
    totalPages: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      theme,
      archivedAfter,
      archivedBefore,
    } = query;

    this.logger.log(
      `Getting archived clips for project ${projectId} - page: ${page}, limit: ${limit}`,
    );

    // Build filter query
    const filter: any = {
      projectId,
      isArchived: true,
    };

    if (theme) {
      filter.theme = theme;
    }

    if (archivedAfter || archivedBefore) {
      filter.archivedAt = {};
      if (archivedAfter) {
        filter.archivedAt.$gte = new Date(archivedAfter);
      }
      if (archivedBefore) {
        filter.archivedAt.$lte = new Date(archivedBefore);
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get clips and total count
    const [clips, totalClips] = await Promise.all([
      this.generatedClipModel
        .find(filter)
        .populate('archivedBy', 'email firstName lastName')
        .sort({ archivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.generatedClipModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalClips / limit);

    this.logger.log(
      `Found ${totalClips} archived clips for project ${projectId}`,
    );

    return {
      clips,
      totalClips,
      currentPage: page,
      totalPages,
      limit,
    };
  }

  /**
   * Update clip status
   */
  private async updateClipStatus(
    clipId: string,
    status: GeneratedClipStatus,
    error?: string,
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === GeneratedClipStatus.PROCESSING) {
      updateData.processingStartedAt = new Date();
    } else if (status === GeneratedClipStatus.FAILED && error) {
      updateData.processingError = error;
    }

    await this.generatedClipModel.findByIdAndUpdate(clipId, updateData).exec();
  }

  /**
   * Convert SRT timestamp to seconds
   */
  private srtToSeconds(srtTime: string): number {
    // Expect "HH:MM:SS,mmm"
    const [hms, ms] = srtTime.split(',');
    const [hh, mm, ss] = hms.split(':').map(Number);
    const millis = Number(ms);
    return hh * 3600 + mm * 60 + ss + millis / 1000;
  }
}
