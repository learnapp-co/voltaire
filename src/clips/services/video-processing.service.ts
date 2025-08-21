import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GeneratedClipDto } from '../dto/clips.dto';

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

  constructor(private configService: ConfigService) {
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
            description: clip.description,
            startTime: clip.startTime,
            endTime: clip.endTime,
            duration: clip.duration,
            transcript: clip.transcript,
            hashtags: clip.hashtags || [],
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
   * Download video from Google Drive (if needed)
   */
  async downloadGoogleDriveVideo(
    fileId: string,
    outputPath: string,
  ): Promise<string> {
    // This would require Google Drive API integration to download the file
    // For now, we'll assume the file is already accessible or return the original path
    this.logger.warn(
      'Google Drive video download not yet implemented. Using direct URL.',
    );
    return outputPath;
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
}
