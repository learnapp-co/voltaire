import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { GeneratedClipDto } from '../dto/clips.dto';
import { S3UploadService } from './s3-upload.service';

export interface VideoClipResult {
  clipId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  duration: number;
  transcript: string;
  hashtags: string[];
  videoUrl: string;
  filePath: string;
  fileSize: number;
  generatedAt: Date;
}

export interface VideoProcessingOptions {
  quality?: string; // 'low' | 'medium' | 'high'
  format?: string; // 'mp4' | 'mov' | 'avi'
  resolution?: string; // '720p' | '1080p' | 'original'
}

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);
  private readonly outputPath: string;

  constructor(
    private configService: ConfigService,
    private s3UploadService: S3UploadService,
  ) {
    this.outputPath = path.join(
      this.configService.get<string>('UPLOAD_PATH') || './uploads',
      'clips',
    );
    this.ensureOutputDirectory();

    // Set FFmpeg path if provided in environment variables
    const ffmpegPath = this.configService.get<string>('FFMPEG_PATH');
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }

    const ffprobePath = this.configService.get<string>('FFPROBE_PATH');
    if (ffprobePath) {
      ffmpeg.setFfprobePath(ffprobePath);
    }
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }

  /**
   * Generate video clips from raw video based on OpenAI timestamps
   */
  async generateVideoClips(
    videoFilePath: string,
    clips: GeneratedClipDto[],
    userId: string,
    projectId: string,
    options: VideoProcessingOptions = {},
  ): Promise<VideoClipResult[]> {
    this.logger.log(
      `Starting video clip generation for project ${projectId}. Generating ${clips.length} clips.`,
    );

    const results: VideoClipResult[] = [];
    const projectOutputDir = path.join(this.outputPath, projectId);

    // Create project-specific directory
    if (!fs.existsSync(projectOutputDir)) {
      fs.mkdirSync(projectOutputDir, { recursive: true });
    }

    try {
      // Process clips sequentially to avoid overwhelming the system
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        this.logger.log(
          `Processing clip ${i + 1}/${clips.length}: ${clip.title}`,
        );

        try {
          const result = await this.generateSingleClip(
            videoFilePath,
            clip,
            projectOutputDir,
            userId,
            i + 1,
            options,
          );
          results.push(result);
        } catch (error) {
          this.logger.error(`Failed to generate clip "${clip.title}":`, error);
          // Continue with other clips even if one fails
        }
      }

      this.logger.log(
        `Video clip generation completed. Successfully generated ${results.length}/${clips.length} clips.`,
      );

      return results;
    } catch (error) {
      this.logger.error('Error during video clip generation:', error);
      throw error;
    }
  }

  /**
   * Generate a single video clip
   */
  private async generateSingleClip(
    videoFilePath: string,
    clip: GeneratedClipDto,
    outputDir: string,
    userId: string,
    clipNumber: number,
    options: VideoProcessingOptions,
  ): Promise<VideoClipResult> {
    return new Promise((resolve, reject) => {
      const clipId = uuidv4();
      const sanitizedTitle = this.sanitizeFileName(clip.title);
      const outputFileName = `clip_${clipNumber}_${sanitizedTitle}_${clipId}.${options.format || 'mp4'}`;
      const outputPath = path.join(outputDir, outputFileName);

      // Calculate duration and validate timestamps
      const duration = clip.endTime - clip.startTime;
      if (duration <= 0) {
        reject(new Error(`Invalid duration for clip "${clip.title}"`));
        return;
      }

      this.logger.log(
        `Cutting clip: ${clip.startTime}s to ${clip.endTime}s (${duration}s)`,
      );

      let command = ffmpeg(videoFilePath)
        .seekInput(clip.startTime)
        .duration(duration)
        .output(outputPath);

      // Apply quality settings
      command = this.applyQualitySettings(command, options);

      command
        .on('start', (commandLine) => {
          this.logger.debug(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            this.logger.debug(
              `Processing clip "${clip.title}": ${Math.round(progress.percent)}%`,
            );
          }
        })
        .on('end', () => {
          this.logger.log(`Successfully generated clip: ${outputFileName}`);

          // Get file size
          const stats = fs.statSync(outputPath);
          const fileSize = stats.size;

          // Generate URL
          const baseUrl =
            this.configService.get<string>('BASE_URL') ||
            'http://localhost:3000';
          const videoUrl = `${baseUrl}/uploads/clips/${path.basename(outputDir)}/${outputFileName}`;

          const result: VideoClipResult = {
            clipId,
            title: clip.title,
            description: '', // Simplified: no description in new DTO
            startTime: clip.startTime,
            endTime: clip.endTime,
            duration: clip.duration,
            transcript: '', // Simplified: no transcript in new DTO
            hashtags: [], // Simplified: no hashtags in new DTO
            videoUrl,
            filePath: outputPath,
            fileSize,
            generatedAt: new Date(),
          };

          resolve(result);
        })
        .on('error', (error) => {
          this.logger.error(`FFmpeg error for clip "${clip.title}":`, error);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Apply quality settings to FFmpeg command
   */
  private applyQualitySettings(
    command: ffmpeg.FfmpegCommand,
    options: VideoProcessingOptions,
  ): ffmpeg.FfmpegCommand {
    const { quality = 'medium', resolution = 'original' } = options;

    // Set video codec and quality
    switch (quality) {
      case 'low':
        command = command
          .videoCodec('libx264')
          .videoBitrate('500k')
          .audioCodec('aac')
          .audioBitrate('64k');
        break;
      case 'high':
        command = command
          .videoCodec('libx264')
          .videoBitrate('2000k')
          .audioCodec('aac')
          .audioBitrate('192k');
        break;
      case 'medium':
      default:
        command = command
          .videoCodec('libx264')
          .videoBitrate('1000k')
          .audioCodec('aac')
          .audioBitrate('128k');
        break;
    }

    // Set resolution
    if (resolution !== 'original') {
      switch (resolution) {
        case '720p':
          command = command.size('1280x720');
          break;
        case '1080p':
          command = command.size('1920x1080');
          break;
      }
    }

    // Add additional optimizations
    command = command.format('mp4').outputOptions([
      '-preset fast', // Faster encoding
      '-movflags +faststart', // Optimize for web streaming
      '-avoid_negative_ts make_zero', // Handle timestamp issues
    ]);

    return command;
  }

  /**
   * Sanitize filename for safe file system usage
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          reject(error);
        } else {
          resolve(metadata);
        }
      });
    });
  }

  /**
   * Clean up generated clips for a project
   */
  async cleanupProjectClips(projectId: string): Promise<void> {
    const projectDir = path.join(this.outputPath, projectId);

    try {
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
        this.logger.log(`Cleaned up clips for project: ${projectId}`);
      }
    } catch (error) {
      this.logger.error(`Error cleaning up project clips: ${projectId}`, error);
    }
  }

  /**
   * Get disk usage for clips
   */
  async getClipsDiskUsage(): Promise<{ totalSize: number; fileCount: number }> {
    let totalSize = 0;
    let fileCount = 0;

    const calculateDirSize = (dirPath: string) => {
      if (!fs.existsSync(dirPath)) return;

      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          calculateDirSize(filePath);
        } else {
          totalSize += stats.size;
          fileCount++;
        }
      }
    };

    calculateDirSize(this.outputPath);

    return { totalSize, fileCount };
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Extract a clip from a source video and upload to S3 (with retry logic for Railway)
   */
  async extractClip(options: ExtractClipOptions): Promise<ExtractClipResult> {
    const maxRetries = 2; // Allow 2 retries for Railway stability
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        this.logger.log(
          `🔄 Video processing attempt ${attempt}/${maxRetries + 1} for clip ${options.clipId}`,
        );
        return await this.extractClipInternal(options, attempt);
      } catch (error) {
        lastError = error;
        this.logger.error(`❌ Attempt ${attempt} failed: ${error.message}`);

        // Don't retry if it's not a resource-related error
        if (!this.isRetryableError(error)) {
          this.logger.log('🚫 Error is not retryable, failing immediately');
          throw error;
        }

        if (attempt <= maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          this.logger.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is retryable (resource-related issues)
   */
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'SIGKILL',
      'memory',
      'timeout',
      'killed',
      'ENOMEM',
      'resource temporarily unavailable',
      'was killed with signal',
    ];

    return retryableMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase()),
    );
  }

  /**
   * Internal method for single attempt at extracting clip
   */
  private async extractClipInternal(
    options: ExtractClipOptions,
    attempt: number,
  ): Promise<ExtractClipResult> {
    const {
      sourceVideoUrl,
      startTime,
      endTime,
      outputFormat = 'mp4',
      quality = 'medium',
      includeFades = false,
      userId,
      projectId,
      clipId,
    } = options;

    // Use lower quality for retries to reduce memory usage
    const adjustedQuality = attempt > 1 ? 'low' : quality;
    // Skip fades on retries for performance
    const adjustedIncludeFades = includeFades && attempt === 1;

    const duration = endTime - startTime;
    const outputFileName = `${userId}_${projectId}_${clipId}_${Date.now()}.${outputFormat}`;
    const outputPath = path.join(this.outputPath, outputFileName);

    let tempSourcePath: string | undefined;

    this.logger.log(
      `🎬 Extracting clip ${clipId} (attempt ${attempt}) from ${sourceVideoUrl}, start: ${startTime}s, end: ${endTime}s`,
    );
    this.logger.log(
      `⚙️ Processing settings - Quality: ${adjustedQuality} (original: ${quality}), Format: ${outputFormat}, Duration: ${duration}s, Fades: ${adjustedIncludeFades}`,
    );
    this.logger.log(`📁 Output file: ${outputFileName}`);

    try {
      // Step 1: Generate signed URL for S3 videos so FFmpeg can access them
      if (this.s3UploadService.isValidS3Url(sourceVideoUrl)) {
        this.logger.log(
          `🔗 Source is S3 URL, generating signed URL for FFmpeg access: ${clipId}`,
        );

        tempSourcePath =
          await this.s3UploadService.generateSignedReadUrl(sourceVideoUrl);
        this.logger.log(`✅ Generated signed URL for FFmpeg input`);
      } else {
        this.logger.log(
          `📁 Source is local file, using direct path: ${sourceVideoUrl}`,
        );
        tempSourcePath = sourceVideoUrl; // Use direct path for local files
      }

      // Step 2: Process video with FFmpeg locally using signed URL
      this.logger.log(`🎞️ Starting FFmpeg processing for clip ${clipId}...`);
      const localResult = await this.processVideoLocally(
        tempSourcePath,
        startTime,
        duration,
        outputPath,
        adjustedQuality,
        adjustedIncludeFades,
      );
      this.logger.log(
        `✅ FFmpeg processing completed - Size: ${localResult.fileSize} bytes`,
      );

      // Step 3: Upload to S3 with project organization
      this.logger.log(`☁️ Uploading clip ${clipId} to S3...`);
      const clipUrl = await this.s3UploadService.uploadLocalFileToS3(
        outputPath,
        projectId,
        clipId,
        outputFormat,
      );
      this.logger.log(`✅ S3 upload completed: ${clipUrl}`);

      // Step 4: Clean up local output file
      this.logger.log(`🧹 Cleaning up local file: ${outputPath}`);
      this.cleanupTempFiles([outputPath]);

      this.logger.log(
        `🎉 Successfully processed and uploaded clip ${clipId} to S3: ${clipUrl}`,
      );

      // Return S3 URL instead of local URL
      return {
        clipUrl, // AWS S3 URL
        fileSize: localResult.fileSize,
        duration,
        format: outputFormat,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error extracting clip ${clipId}:`, error);

      // Clean up local output file on error
      this.cleanupTempFiles([outputPath]);

      throw error;
    }
  }

  /**
   * Process video locally with FFmpeg (optimized for Railway)
   */
  private async processVideoLocally(
    sourceVideoUrl: string,
    startTime: number,
    duration: number,
    outputPath: string,
    quality: string,
    includeFades: boolean,
  ): Promise<{ fileSize: number }> {
    return new Promise((resolve, reject) => {
      // Set a timeout to prevent infinite hanging (Railway has 30min timeout)
      const timeoutMs = 25 * 60 * 1000; // 25 minutes
      const timeout = setTimeout(() => {
        this.logger.error('FFmpeg process timed out, killing...');
        command.kill('SIGKILL');
        reject(new Error('Video processing timed out'));
      }, timeoutMs);

      let command = ffmpeg(sourceVideoUrl)
        .seekInput(startTime)
        .duration(duration)
        .output(outputPath)
        // Railway optimization: limit memory usage
        .addOptions([
          '-threads',
          '2', // Limit CPU threads for Railway
          '-preset',
          'fast', // Faster encoding, less CPU intensive
          '-movflags',
          '+faststart', // Optimize for streaming
          '-avoid_negative_ts',
          'make_zero', // Avoid timestamp issues
        ]);

      // Set quality settings optimized for Railway
      switch (quality) {
        case 'low':
          command = command
            .videoBitrate('400k')
            .audioBitrate('64k')
            .size('640x360') // Reduce resolution for faster processing
            .fps(24); // Reduce fps for lower resource usage
          break;
        case 'high':
          command = command
            .videoBitrate('1500k')
            .audioBitrate('128k')
            .size('1280x720') // Cap at 720p for Railway limits
            .fps(30);
          break;
        default: // medium
          command = command
            .videoBitrate('800k')
            .audioBitrate('96k')
            .size('854x480') // 480p for balance
            .fps(25);
      }

      // Add fade effects if requested (simplified for performance)
      if (includeFades && duration > 2) {
        // Only add fades for longer clips
        const fadeFrames = Math.min(15, Math.floor(duration * 12)); // Shorter fades
        command = command.videoFilters([
          `fade=in:0:${fadeFrames}`,
          `fade=out:${Math.max(0, duration * 25 - fadeFrames)}:${fadeFrames}`,
        ]);
      }

      // Add Railway-specific optimizations
      command = command.addOptions([
        '-maxrate',
        quality === 'high' ? '1500k' : quality === 'low' ? '400k' : '800k',
        '-bufsize',
        quality === 'high' ? '3000k' : quality === 'low' ? '800k' : '1600k',
        '-profile:v',
        'baseline', // Use baseline profile for better compatibility
        '-level',
        '3.0',
        '-pix_fmt',
        'yuv420p', // Ensure compatibility
      ]);

      command
        .on('start', (commandLine) => {
          this.logger.log(
            `FFmpeg process started (Railway optimized): ${commandLine}`,
          );
        })
        .on('progress', (progress) => {
          this.logger.debug(
            `Processing: ${Math.round(progress.percent || 0)}% done, time: ${progress.timemark}`,
          );
        })
        .on('end', () => {
          clearTimeout(timeout);
          this.logger.log(`Local clip generation completed: ${outputPath}`);

          // Get file stats
          try {
            const stats = fs.statSync(outputPath);
            resolve({ fileSize: stats.size });
          } catch (error) {
            this.logger.error(`Error getting file stats: ${error.message}`);
            reject(new Error('Failed to get output file stats'));
          }
        })
        .on('error', (error) => {
          clearTimeout(timeout);
          this.logger.error(`FFmpeg error: ${error.message}`);

          // Provide more specific error information
          if (error.message.includes('SIGKILL')) {
            reject(
              new Error(
                'Video processing was killed (likely due to memory limits). Try with lower quality setting.',
              ),
            );
          } else if (error.message.includes('timeout')) {
            reject(
              new Error(
                'Video processing timed out. The clip might be too long or complex.',
              ),
            );
          } else {
            reject(error);
          }
        })
        .run();
    });
  }

  /**
   * Download S3 video to temporary local storage
   */
  private async downloadS3VideoToTemp(
    s3Url: string,
    sessionId: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempFileName = `source_${sessionId}.mp4`;
      const tempFilePath = path.join(this.outputPath, 'temp', tempFileName);

      // Ensure temp directory exists
      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      this.logger.log(`Downloading S3 video to temp: ${tempFilePath}`);

      const file = fs.createWriteStream(tempFilePath);

      https
        .get(s3Url, (response) => {
          if (response.statusCode === 403) {
            reject(
              new Error(
                'S3 access denied. Video may not be publicly accessible.',
              ),
            );
            return;
          }

          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Failed to download video: HTTP ${response.statusCode}`,
              ),
            );
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            this.logger.log(
              `S3 video downloaded successfully: ${tempFilePath}`,
            );
            resolve(tempFilePath);
          });
        })
        .on('error', (error) => {
          fs.unlink(tempFilePath, () => {}); // Clean up on error
          this.logger.error(`Error downloading S3 video: ${error.message}`);
          reject(error);
        });
    });
  }

  /**
   * Extract multiple segments from a video and stitch them together
   */
  async extractAndStitchSegments(
    options: ExtractMultiSegmentOptions,
  ): Promise<ExtractClipResult> {
    const {
      sourceVideoUrl,
      segments,
      outputFormat = 'mp4',
      quality = 'medium',
      includeFades = false,
      userId,
      projectId,
      clipId,
    } = options;

    const outputFileName = `${userId}_${projectId}_${clipId}_franken_${Date.now()}.${outputFormat}`;
    const outputPath = path.join(this.outputPath, outputFileName);

    let tempSourcePath: string | undefined;
    const tempSegmentPaths: string[] = [];

    this.logger.log(
      `🎬 Extracting ${segments.length} segments for Franken-Clip ${clipId} from ${sourceVideoUrl}`,
    );

    try {
      // Step 1: Generate signed URL for S3 videos so FFmpeg can access them
      if (this.s3UploadService.isValidS3Url(sourceVideoUrl)) {
        this.logger.log(
          `🔗 Source is S3 URL, generating signed URL for FFmpeg access: ${clipId}`,
        );
        tempSourcePath =
          await this.s3UploadService.generateSignedReadUrl(sourceVideoUrl);
        this.logger.log(`✅ Generated signed URL for FFmpeg input`);
      } else {
        this.logger.log(
          `📁 Source is local file, using direct path: ${sourceVideoUrl}`,
        );
        tempSourcePath = sourceVideoUrl;
      }

      // Step 2: Extract each segment individually
      this.logger.log(
        `🎞️ Extracting ${segments.length} individual segments...`,
      );
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentFileName = `segment_${i + 1}_${clipId}_${Date.now()}.${outputFormat}`;
        const segmentPath = path.join(this.outputPath, segmentFileName);

        this.logger.log(
          `📹 Extracting segment ${i + 1}/${segments.length}: ${segment.startTime}s to ${segment.endTime}s (purpose: ${segment.purpose})`,
        );

        await this.extractSingleSegment(
          tempSourcePath,
          segment.startTime,
          segment.endTime - segment.startTime,
          segmentPath,
          quality,
        );

        tempSegmentPaths.push(segmentPath);
        this.logger.log(`✅ Segment ${i + 1} extracted successfully`);
      }

      // Step 3: Stitch all segments together
      this.logger.log(
        `🔧 Stitching ${tempSegmentPaths.length} segments together...`,
      );
      const totalDuration = segments.reduce(
        (total, segment) => total + segment.duration,
        0,
      );

      await this.stitchSegments(tempSegmentPaths, outputPath, includeFades);
      this.logger.log(`✅ Segments stitched successfully`);

      // Step 4: Get file stats
      const stats = fs.statSync(outputPath);
      const fileSize = stats.size;

      // Step 5: Upload to S3
      this.logger.log(`☁️ Uploading Franken-Clip ${clipId} to S3...`);
      const clipUrl = await this.s3UploadService.uploadLocalFileToS3(
        outputPath,
        projectId,
        clipId,
        outputFormat,
      );
      this.logger.log(`✅ S3 upload completed: ${clipUrl}`);

      // Step 6: Clean up all temporary files
      this.logger.log(`🧹 Cleaning up temporary files...`);
      this.cleanupTempFiles([outputPath, ...tempSegmentPaths]);

      this.logger.log(
        `🎉 Successfully processed and uploaded Franken-Clip ${clipId} with ${segments.length} segments to S3: ${clipUrl}`,
      );

      return {
        clipUrl,
        fileSize,
        duration: totalDuration,
        format: outputFormat,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Error extracting and stitching segments for clip ${clipId}:`,
        error,
      );

      // Clean up all temporary files on error
      this.cleanupTempFiles([outputPath, ...tempSegmentPaths]);

      throw error;
    }
  }

  /**
   * Extract a single segment from video
   */
  private async extractSingleSegment(
    sourceVideoUrl: string,
    startTime: number,
    duration: number,
    outputPath: string,
    quality: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(sourceVideoUrl)
        .seekInput(startTime)
        .duration(duration)
        .output(outputPath);

      // Set quality settings
      switch (quality) {
        case 'low':
          command = command.videoBitrate('500k').audioBitrate('64k');
          break;
        case 'high':
          command = command.videoBitrate('2000k').audioBitrate('192k');
          break;
        default: // medium
          command = command.videoBitrate('1000k').audioBitrate('128k');
      }

      command
        .on('start', (commandLine) => {
          this.logger.debug(
            `FFmpeg segment extraction started: ${commandLine}`,
          );
        })
        .on('progress', (progress) => {
          this.logger.debug(
            `Segment extraction: ${Math.round(progress.percent || 0)}% done`,
          );
        })
        .on('end', () => {
          this.logger.debug(`Segment extraction completed: ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          this.logger.error(
            `FFmpeg segment extraction error: ${error.message}`,
          );
          reject(error);
        })
        .run();
    });
  }

  /**
   * Stitch multiple video segments together
   */
  private async stitchSegments(
    segmentPaths: string[],
    outputPath: string,
    includeFades: boolean = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (segmentPaths.length === 0) {
        reject(new Error('No segments provided for stitching'));
        return;
      }

      if (segmentPaths.length === 1) {
        // If only one segment, just copy it
        fs.copyFileSync(segmentPaths[0], outputPath);
        resolve();
        return;
      }

      this.logger.log(
        `Stitching ${segmentPaths.length} segments using concat demuxer method`,
      );

      // Use concat demuxer method which is more reliable for identical formats
      this.stitchUsingConcatDemuxer(segmentPaths, outputPath, includeFades)
        .then(resolve)
        .catch((concatError) => {
          this.logger.warn(
            `Concat demuxer failed: ${concatError.message}, trying complex filter method`,
          );

          // Fallback to complex filter method
          this.stitchUsingComplexFilter(segmentPaths, outputPath, includeFades)
            .then(resolve)
            .catch(reject);
        });
    });
  }

  /**
   * Stitch using concat demuxer (faster, more reliable for same-format files)
   */
  private async stitchUsingConcatDemuxer(
    segmentPaths: string[],
    outputPath: string,
    includeFades: boolean,
  ): Promise<void> {
    // Check if output directory exists and create it if needed
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    return new Promise((resolve, reject) => {
      // Create temporary concat file list with absolute paths
      const concatListPath = path.resolve(
        this.outputPath,
        `concat_list_${Date.now()}.txt`,
      );

      // Convert all segment paths to absolute paths and verify they exist
      const absoluteSegmentPaths: string[] = [];
      for (const segmentPath of segmentPaths) {
        const absolutePath = path.resolve(segmentPath);
        if (!fs.existsSync(absolutePath)) {
          throw new Error(`Segment file not found: ${absolutePath}`);
        }
        absoluteSegmentPaths.push(absolutePath);
      }

      this.logger.debug(`Creating concat list file: ${concatListPath}`);
      this.logger.debug(
        `Segment files to concatenate: ${absoluteSegmentPaths.join(', ')}`,
      );

      try {
        // Ensure output directory exists
        const concatDir = path.dirname(concatListPath);
        if (!fs.existsSync(concatDir)) {
          fs.mkdirSync(concatDir, { recursive: true });
        }

        // Ensure proper escaping of paths in the concat file
        const escapedConcatContent = absoluteSegmentPaths
          .map(
            (p) =>
              `file '${p.replace(/'/g, "'\\''")}' # ${new Date().toISOString()}`,
          )
          .join('\n');

        fs.writeFileSync(concatListPath, escapedConcatContent);

        // Verify file was created and is readable
        if (!fs.existsSync(concatListPath)) {
          throw new Error(
            `Failed to create concat list file: ${concatListPath}`,
          );
        }

        const fileStats = fs.statSync(concatListPath);
        this.logger.debug(
          `Concat list file created successfully: ${concatListPath} (${fileStats.size} bytes)`,
        );

        // Check if output directory exists and is writable
        try {
          // Test write access to output directory
          const testFile = path.join(
            path.dirname(outputPath),
            `.test_${Date.now()}`,
          );
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
        } catch (err) {
          throw new Error(
            `Output directory is not writable: ${path.dirname(outputPath)}: ${err.message}`,
          );
        }

        let command = ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .videoCodec('copy')
          .audioCodec('copy')
          .outputOptions(['-movflags', '+faststart'])
          .output(outputPath);

        // Add fade effects if requested (note: this disables stream copy)
        if (includeFades) {
          command = command
            .videoCodec('libx264')
            .audioCodec('aac')
            .videoFilters(['fade=in:0:30', 'fade=out:st=end-1:d=1']);
        }

        command
          .on('start', (commandLine) => {
            this.logger.log(`FFmpeg concat demuxer started: ${commandLine}`);
          })
          .on('progress', (progress) => {
            this.logger.debug(
              `Concat progress: ${Math.round(progress.percent || 0)}% done`,
            );
          })
          .on('end', () => {
            // Clean up concat list file
            fs.unlink(concatListPath, () => {});
            this.logger.log(`Concat demuxer completed: ${outputPath}`);
            resolve();
          })
          .on('error', (error) => {
            // Clean up concat list file
            fs.unlink(concatListPath, () => {});
            this.logger.error(`FFmpeg concat demuxer error: ${error.message}`);
            reject(error);
          })
          .run();
      } catch (fsError) {
        this.logger.error(
          `Error creating concat list file: ${fsError.message}`,
        );
        reject(fsError);
      }
    });
  }

  /**
   * Stitch using complex filter (fallback method, more compatible but slower)
   */
  private async stitchUsingComplexFilter(
    segmentPaths: string[],
    outputPath: string,
    includeFades: boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create FFmpeg command for concatenation
      let command = ffmpeg();

      // Add all input files
      segmentPaths.forEach((segmentPath) => {
        command = command.input(segmentPath);
      });

      // Set up concatenation
      command = command
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg complex filter started: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.debug(
            `Complex filter progress: ${Math.round(progress.percent || 0)}% done`,
          );
        })
        .on('end', () => {
          this.logger.log(`Complex filter completed: ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          this.logger.error(`FFmpeg complex filter error: ${error.message}`);
          reject(error);
        });

      try {
        // Use a simpler filter approach that's more tolerant of stream issues
        let filterComplex = '';

        // Create input chains
        for (let i = 0; i < segmentPaths.length; i++) {
          if (i > 0) filterComplex += '[';
          if (i > 0) filterComplex += 'v' + (i - 1);
          if (i > 0) filterComplex += '][';
          if (i > 0) filterComplex += 'a' + (i - 1);
          if (i > 0) filterComplex += ']';
          filterComplex += `[${i}:v][${i}:a]`;
          filterComplex += `concat=n=1:v=1:a=1`;
          if (i < segmentPaths.length - 1) {
            filterComplex += `[v${i}][a${i}]`;
          } else {
            filterComplex += '[outv][outa]';
          }
          if (i < segmentPaths.length - 1) filterComplex += ';';
        }

        this.logger.debug(`Using filter complex: ${filterComplex}`);

        command = command
          .complexFilter(filterComplex)
          .outputOptions(['-map', '[outv]', '-map', '[outa]'])
          .videoCodec('libx264')
          .audioCodec('aac')
          .output(outputPath);

        // Add fade effects if requested
        if (includeFades) {
          // Note: Fades with concat filter require more complex filter graph
          this.logger.warn(
            'Fade effects with complex filter not fully implemented yet',
          );
        }

        command.run();
      } catch (filterError) {
        this.logger.error(
          `Error building complex filter: ${filterError.message}`,
        );
        reject(filterError);
      }
    });
  }

  /**
   * Clean up temporary files
   */
  private cleanupTempFiles(filePaths: (string | undefined)[]): void {
    for (const filePath of filePaths) {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          this.logger.debug(`Cleaned up temp file: ${filePath}`);
        } catch (error) {
          this.logger.warn(`Failed to clean up temp file ${filePath}:`, error);
        }
      }
    }
  }
}

export interface ExtractClipOptions {
  sourceVideoUrl: string;
  startTime: number;
  endTime: number;
  outputFormat?: string;
  quality?: string;
  includeFades?: boolean;
  userId: string;
  projectId: string;
  clipId: string;
}

export interface ExtractMultiSegmentOptions {
  sourceVideoUrl: string;
  segments: Array<{
    startTime: number;
    endTime: number;
    duration: number;
    purpose: string;
    sequenceOrder: number;
  }>;
  outputFormat?: string;
  quality?: string;
  includeFades?: boolean;
  userId: string;
  projectId: string;
  clipId: string;
}

export interface ExtractClipResult {
  clipUrl: string;
  fileSize: number;
  duration: number;
  format: string;
  processedAt: Date;
}
