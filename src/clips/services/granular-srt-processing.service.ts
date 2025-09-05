import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { S3UploadService } from './s3-upload.service';
import { ClipRecipe } from './ai-clip-generation.service';

export interface NumericSegment {
  fileIndex: number;
  start_sec: number;
  end_sec: number;
  label: string;
}

export interface StitchOptions {
  fps?: number;
  width?: number;
  height?: number;
  crossfade?: boolean;
  crossfadeDur?: number;
}

export interface StitchResult {
  outputPath: string;
  fileSize: number;
  duration: number;
}

@Injectable()
export class GranularSrtProcessingService {
  private readonly logger = new Logger(GranularSrtProcessingService.name);
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
   * Convert SRT timestamp to seconds
   */
  srtToSeconds(srtTime: string): number {
    // Expect "HH:MM:SS,mmm"
    const [hms, ms] = srtTime.split(',');
    const [hh, mm, ss] = hms.split(':').map(Number);
    const millis = Number(ms);
    return hh * 3600 + mm * 60 + ss + millis / 1000;
  }

  /**
   * Convert seconds to SRT timestamp
   */
  secondsToSrt(seconds: number): string {
    const ms = Math.round((seconds % 1) * 1000);
    const total = Math.floor(seconds);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${pad(hh)}:${pad(mm)}:${pad(ss)},${String(ms).padStart(3, '0')}`;
  }

  /**
   * Convert recipe timestamps to numeric segments
   */
  toNumericSegmentsFromRecipe(
    recipe: ClipRecipe,
    fileIndex = 0,
  ): NumericSegment[] {
    return recipe.timestamps.map((ts) => ({
      fileIndex,
      start_sec: this.srtToSeconds(ts.start_str),
      end_sec: this.srtToSeconds(ts.end_str),
      label: ts.label,
    }));
  }

  /**
   * Build a single-pass filter_complex graph
   */
  private buildFilterGraph(
    segments: NumericSegment[],
    opts: StitchOptions,
  ): {
    filter: string;
    mapV: string;
    mapA: string;
    needsConcat: boolean;
  } {
    const {
      fps = 30,
      width = 1080,
      height = 1920, // default 9:16
      crossfade = false,
      crossfadeDur = 0.3, // seconds
    } = opts;

    // For robust social output: scale + pad to match exact WxH without distorting
    const vfFit = `scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${fps},format=yuv420p`;

    // Build per-input trims and labels
    const vLabels = [];
    const aLabels = [];
    const lines = [];

    segments.forEach((seg, i) => {
      const vIn = `${seg.fileIndex}:v:0`;
      const aIn = `${seg.fileIndex}:a:0`;

      lines.push(
        `[${vIn}]trim=start=${seg.start_sec}:end=${seg.end_sec},setpts=PTS-STARTPTS,${vfFit}[v${i}]`,
      );
      lines.push(
        `[${aIn}]atrim=start=${seg.start_sec}:end=${seg.end_sec},asetpts=PTS-STARTPTS,aresample=async=1:min_hard_comp=0.100:first_pts=0[a${i}]`,
      );
      vLabels.push(`[v${i}]`);
      aLabels.push(`[a${i}]`);
    });

    let vChain = vLabels.join('');
    let aChain = aLabels.join('');

    // Optional crossfade
    if (crossfade && segments.length > 1) {
      // Successively xfade v0 with v1 => vx1, then vx1 with v2 => vx2 ...
      let currentV = `[v0]`;
      let currentA = `[a0]`;
      const filterLines = [];

      for (let i = 1; i < segments.length; i++) {
        const prevDur = segments[i - 1].end_sec - segments[i - 1].start_sec;
        const xfadeStart = Math.max(0, prevDur - crossfadeDur).toFixed(3);

        filterLines.push(
          `${currentV}[v${i}]xfade=transition=fade:duration=${crossfadeDur}:offset=${xfadeStart}[vx${i}]`,
        );
        filterLines.push(
          `${currentA}[a${i}]acrossfade=d=${crossfadeDur}[ax${i}]`,
        );

        currentV = `[vx${i}]`;
        currentA = `[ax${i}]`;
      }

      lines.push(...filterLines);
      vChain = currentV;
      aChain = currentA;

      // No concat needed (we already combined)
      return {
        filter: [...lines, `;`].join(''),
        mapV: vChain,
        mapA: aChain,
        needsConcat: false,
      };
    }

    // No crossfade -> concat straightforwardly
    const concatLine = `${vChain}${aChain}concat=n=${segments.length}:v=1:a=1[vc][ac]`;
    lines.push(concatLine);

    return {
      filter: lines.join(';'),
      mapV: '[vc]',
      mapA: '[ac]',
      needsConcat: true,
    };
  }

  /**
   * Execute FFmpeg with given inputs and filter graph
   */
  async stitchSegments(
    inputFile: string,
    segments: NumericSegment[],
    outputPath: string,
    options: StitchOptions = {},
  ): Promise<StitchResult> {
    return new Promise((resolve, reject) => {
      try {
        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const { filter, mapV, mapA } = this.buildFilterGraph(segments, options);

        const command = ffmpeg(inputFile);

        // Apply filter complex
        command
          .complexFilter(filter)
          .outputOptions([
            '-map',
            mapV,
            '-map',
            mapA,
            '-movflags',
            '+faststart',
            '-preset',
            'veryfast',
            '-crf',
            '20',
            '-pix_fmt',
            'yuv420p',
            '-c:v',
            'libx264',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-shortest',
          ])
          .output(outputPath);

        // Set up event handlers
        command
          .on('start', (commandLine) => {
            this.logger.log(`FFmpeg started: ${commandLine}`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              this.logger.debug(`Progress: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            try {
              const stats = fs.statSync(outputPath);
              const fileSize = stats.size;

              // Calculate total duration
              const totalDuration = segments.reduce(
                (total, segment) =>
                  total + (segment.end_sec - segment.start_sec),
                0,
              );

              this.logger.log(`Stitching completed: ${outputPath}`);
              resolve({
                outputPath,
                fileSize,
                duration: totalDuration,
              });
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (error) => {
            this.logger.error(`FFmpeg error: ${error.message}`);
            reject(error);
          });

        // Run the command
        command.run();
      } catch (error) {
        this.logger.error(`Error setting up FFmpeg: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Process a ClipRecipe into a video file
   */
  async processClipRecipe(
    recipe: ClipRecipe,
    sourceVideoUrl: string,
    userId: string,
    projectId: string,
    clipId: string,
  ): Promise<{
    clipUrl: string;
    fileSize: number;
    duration: number;
  }> {
    // Convert recipe timestamps to numeric segments
    const segments = this.toNumericSegmentsFromRecipe(recipe);

    // Determine aspect ratio based on metadata or default to 9:16
    const { width, height } = this.aspectToWH('9:16');

    // Create output filename
    const outputFileName = `${userId}_${projectId}_${clipId}_${Date.now()}.mp4`;
    const outputPath = path.join(this.outputPath, outputFileName);

    let tempSourcePath: string;

    try {
      // Step 1: Get source video (generate signed URL if needed)
      if (this.s3UploadService.isValidS3Url(sourceVideoUrl)) {
        this.logger.log(
          `Generating signed URL for S3 video: ${sourceVideoUrl}`,
        );
        tempSourcePath =
          await this.s3UploadService.generateSignedReadUrl(sourceVideoUrl);
      } else {
        tempSourcePath = sourceVideoUrl;
      }

      // Step 2: Stitch segments
      this.logger.log(
        `Processing ${segments.length} segments for clip ${clipId}`,
      );
      const stitchResult = await this.stitchSegments(
        tempSourcePath,
        segments,
        outputPath,
        {
          width,
          height,
          fps: 30,
          crossfade: false, // Default to no crossfade
        },
      );

      // Step 3: Upload to S3
      this.logger.log(`Uploading processed clip to S3: ${clipId}`);
      const clipUrl = await this.s3UploadService.uploadLocalFileToS3(
        outputPath,
        projectId,
        clipId,
        'mp4',
      );

      // Step 4: Clean up local file
      fs.unlinkSync(outputPath);

      return {
        clipUrl,
        fileSize: stitchResult.fileSize,
        duration: stitchResult.duration,
      };
    } catch (error) {
      this.logger.error(`Error processing clip recipe: ${error.message}`);

      // Clean up any temporary files
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      throw error;
    }
  }

  /**
   * Convert aspect ratio string to width and height
   */
  private aspectToWH(aspect: string): { width: number; height: number } {
    switch (aspect) {
      case '16:9':
        return { width: 1920, height: 1080 };
      case '1:1':
        return { width: 1080, height: 1080 };
      case '9:16':
      default:
        return { width: 1080, height: 1920 };
    }
  }
}
