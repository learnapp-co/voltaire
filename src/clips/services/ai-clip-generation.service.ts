import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import {
  GeneratedClip,
  GeneratedClipDocument,
  GeneratedClipStatus,
  PredefinedTheme,
} from '../../schemas/generated-clip.schema';
import { OpenAIModel } from '../../schemas/clip.schema';
import { OpenAIService, SRTEntry } from './openai.service';
import { SupportedModelsResponseDto } from '../dto/clips.dto';

export interface LogicalSegment {
  startTime: string; // HH:MM:SS,mmm format
  endTime: string; // HH:MM:SS,mmm format
  purpose: 'hook' | 'build' | 'payoff'; // Narrative purpose
}

export interface TimestampSegment {
  label: string; // What this segment covers
  start_str: string; // "HH:MM:SS,mmm" format
  end_str: string; // "HH:MM:SS,mmm" format
  duration: number; // Duration in seconds
}

export interface ClipRecipe {
  title: string; // Compelling hook title with emoji
  description: string; // Brief description for social media
  theme_category: string; // Primary theme from user's selection
  timestamps?: TimestampSegment[]; // 3-4 logical segments (older format)
  segments?: TimestampSegment[]; // 3-4 logical segments (newer format)
}

export interface AIClipRequest {
  title: string;
  description: string;
  segments: LogicalSegment[]; // Multiple non-contiguous segments
  hashtags: string[];
  confidence: number;
  keywords: string[];
  reasoning?: string;
  totalDuration: number; // Combined duration of all segments
}

export interface ThemeGenerationRequest {
  projectId: string;
  theme: string;
  isCustomTheme?: boolean;
  maxClips?: number; // Max 20
  model?: OpenAIModel;
}

export interface ThemeGenerationResponse {
  generationId: string;
  theme: string;
  totalClips: number;
  clips: GeneratedClip[];
}

@Injectable()
export class AIClipGenerationService {
  private readonly logger = new Logger(AIClipGenerationService.name);
  private openai: OpenAI;

  // System prompt for Franken-Clips AI generation with granular SRT processing
  private buildSystemPrompt(
    theme: string,
    maxClips: number,
    srtEntries: string,
  ): string {
    return `You are an expert viral video editor specializing in "Franken-Clips".
Your task is to create ${maxClips} compelling clips by stitching together non-contiguous segments based on the theme: "${theme}".

GRANULAR SRT TRANSCRIPT (word-level):
${srtEntries}

CRITICAL INSTRUCTION: THE INPUT FORMAT
You will receive a highly granular, 'word-level' SRT transcript. Each numbered line may only be a word or a short phrase. Your primary task is to group these small lines together to form longer, meaningful "Logical Segments".

🔥 YOUR 3-STEP EDITING PROCESS:

STEP 1: Identify a "Logical Segment"
- A "Logical Segment" is a complete sentence or a powerful idea that aligns with the user's chosen themes.
- To create one, you must group together several consecutive granular SRT lines.

STEP 2: Determine the Precise Timestamp for your Logical Segment
- Use the START time of the FIRST granular line in your group.
- Use the END time of the LAST granular line in your group.
- Example: If you group lines 10, 11, and 12, your final timestamp is [START_TIME_of_10] --> [END_TIME_of_12].

STEP 3: Build the Franken-Clip
- CRITICAL UNDERSTANDING: Each requested clip should contain 2-3 "Logical Segments" from DIFFERENT parts of the transcript (2+ minutes apart).
- If user requests 2 clips, create 2 clips with 2-3 segments each (total 4-6 segments across both clips).
- If user requests 3 clips, create 3 clips with 2-3 segments each (total 6-9 segments across all clips).
- CRITICAL: Each segment MUST be 20-25 seconds only! Segments over 60 seconds will be automatically rejected and filtered out!
- Each clip should have a total combined duration of 45-75 seconds when all its segments are combined.
- Arrange each clip's segments into a HOOK → BUILD → PAYOFF narrative structure.
- You MUST prioritize the user-selected themes provided in the prompt.

📦 STRICT REQUIREMENTS:

Coherence Validation:
- Strong hook: YES - It creates powerful curiosity.
- Logical flow: YES - The story builds perfectly.
- Satisfying payoff: YES - It delivers a strong emotional or intellectual reward.
- APPROVED: YES

Viral Strategy:
[Explain why grouping these specific phrases creates a powerful narrative that aligns with the chosen theme.]

- You MUST group granular lines and use the start-time-of-first and end-time-of-last for your timestamps.
- You MUST focus on the user-selected themes.
- Each clip should contain 2-3 timestamp segments.
- IMPORTANT: Each individual segment duration MUST be under 60 seconds or it will be rejected!
- You MUST include "APPROVED: YES" in your validation.

Return only JSON in this exact structure - MUST BE AN ARRAY even for a single clip:
{ clips:
[
 {
   "title": "Compelling hook title that creates curiosity with emoji",
   "description": "Brief description for social media posts",
   "theme_category": "Primary theme from user's selection",
   "timestamps": [
     { "label": "Hook: Opening that grabs attention", "start_str": "HH:MM:SS,mmm", "end_str": "HH:MM:SS,mmm", "duration": "MUST be 20-25 seconds only!"},
     { "label": "Build: Supporting content or development", "start_str": "HH:MM:SS,mmm", "end_str": "HH:MM:SS,mmm", "duration": "MUST be 20-25 seconds only!"},
     { "label": "Payoff: Conclusion or key insight", "start_str": "HH:MM:SS,mmm", "end_str": "HH:MM:SS,mmm", "duration": "MUST be 20-25 seconds only!"}
   ]
 }
  ]
 }`;
  }

  constructor(
    @InjectModel(GeneratedClip.name)
    private generatedClipModel: Model<GeneratedClipDocument>,
    private configService: ConfigService,
    private openAIService: OpenAIService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'OpenAI API key not found. AI clip generation will not be available.',
      );
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Generate AI clips for a specific theme
   */
  async generateClipsForTheme(
    request: ThemeGenerationRequest,
    srtContent: string,
  ): Promise<ThemeGenerationResponse> {
    try {
      this.logger.log(
        `Generating clips for theme: ${request.theme}, Project: ${request.projectId}`,
      );

      // Validate theme limits (max 3 themes per project)
      await this.validateThemeLimit(request.projectId, request.theme);

      // Validate model
      if (request.model && !this.isSupportedModel(request.model)) {
        throw new BadRequestException(
          `Unsupported model: ${request.model}. Use GET /clips/models/supported to see available models.`,
        );
      }

      // Validate clip count
      const maxClips = Math.min(request.maxClips || 20, 20);

      // Check if theme already exists and has clips
      const existingClips = await this.getClipsByTheme(
        request.projectId,
        request.theme,
      );

      if (existingClips.length > 0) {
        throw new BadRequestException(
          `Theme "${request.theme}" already has generated clips. Please Discard all existing clips and regenerate.`,
        );
      }

      // Parse SRT and prepare transcript
      const srtEntries = this.openAIService.parseSRT(srtContent);
      // Generate clips using AI
      const generationId = uuidv4();
      const aiClips = await this.callOpenAIForClipGeneration(
        request.theme,
        srtEntries,
        maxClips,
        request.model || OpenAIModel.GPT_4_1_MINI,
      );

      // Save generated clips to database
      const savedClips = await this.saveGeneratedClips(
        request.projectId,
        request.theme,
        request.isCustomTheme || false,
        generationId,
        aiClips,
        srtEntries,
      );

      this.logger.log(
        `Successfully generated ${savedClips.length} clips for theme: ${request.theme}`,
      );

      return {
        generationId,
        theme: request.theme,
        totalClips: savedClips.length,
        clips: savedClips,
      };
    } catch (error) {
      this.logger.error(
        `Error generating clips for theme ${request.theme}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all clips for a specific theme (excludes archived clips by default)
   */
  async getClipsByTheme(
    projectId: string,
    theme: string,
    includeArchived: boolean = false,
  ): Promise<GeneratedClip[]> {
    const filter: any = {
      projectId,
      theme,
      status: { $ne: GeneratedClipStatus.DISCARDED },
    };

    // Exclude archived clips by default
    if (!includeArchived) {
      filter.isArchived = { $ne: true };
    }

    return await this.generatedClipModel
      .find(filter)
      .sort({ clipSequence: 1 })
      .exec();
  }

  /**
   * Get all themes for a project
   */
  async getThemesForProject(projectId: string): Promise<string[]> {
    const themes = await this.generatedClipModel
      .distinct('theme', {
        projectId,
        status: { $ne: GeneratedClipStatus.DISCARDED },
      })
      .exec();
    return themes;
  }

  /**
   * Discard all clips for a specific theme
   */
  async discardAllClipsForTheme(
    projectId: string,
    theme: string,
  ): Promise<void> {
    await this.generatedClipModel
      .updateMany(
        { projectId, theme },
        {
          status: GeneratedClipStatus.DISCARDED,
          updatedAt: new Date(),
        },
      )
      .exec();

    this.logger.log(
      `Discarded all clips for theme: ${theme}, Project: ${projectId}`,
    );
  }

  /**
   * Discard a specific clip
   */
  async discardClip(clipId: string): Promise<void> {
    const result = await this.generatedClipModel
      .updateOne(
        { _id: clipId },
        {
          status: GeneratedClipStatus.DISCARDED,
          updatedAt: new Date(),
        },
      )
      .exec();

    if (result.matchedCount === 0) {
      throw new BadRequestException('Clip not found');
    }

    this.logger.log(`Discarded clip: ${clipId}`);
  }

  /**
   * Refine a specific clip with new timestamps
   */
  async refineClip(
    clipId: string,
    newStartTime: number,
    newEndTime: number,
  ): Promise<GeneratedClip> {
    const clip = await this.generatedClipModel.findById(clipId).exec();
    if (!clip) {
      throw new BadRequestException('Clip not found');
    }

    // Store original timestamp if not already stored
    if (!clip.originalTimeStamp) {
      clip.originalTimeStamp = { ...clip.timeStamp };
    }

    // Add current timestamp to refinement history
    clip.refinementHistory.push({ ...clip.timeStamp });

    // Update with new timestamps
    clip.timeStamp = {
      startTime: newStartTime,
      endTime: newEndTime,
      duration: newEndTime - newStartTime,
    };

    clip.lastRefinedAt = new Date();
    clip.status = GeneratedClipStatus.PENDING; // Will need re-processing

    const updatedClip = await clip.save();
    this.logger.log(
      `Refined clip ${clipId} with new timestamps: ${newStartTime}s-${newEndTime}s`,
    );

    return updatedClip;
  }

  /**
   * Get predefined themes
   */
  getPredefinedThemes(): string[] {
    return Object.values(PredefinedTheme);
  }

  /**
   * Get all custom themes that have been used in the system
   */
  async getCustomThemes(): Promise<string[]> {
    const customThemes = await this.generatedClipModel
      .distinct('theme', {
        isCustomTheme: true,
        status: { $ne: GeneratedClipStatus.DISCARDED },
      })
      .exec();

    return customThemes.sort();
  }

  /**
   * Get all available theme names (predefined + custom)
   */
  async getAllAvailableThemes(): Promise<string[]> {
    const predefinedThemes = this.getPredefinedThemes();
    const customThemes = await this.getCustomThemes();

    // Combine and remove duplicates, then sort
    const allThemes = [...new Set([...predefinedThemes, ...customThemes])];
    return allThemes.sort();
  }

  /**
   * Get all themes (predefined + custom) with usage statistics
   */
  async getAllThemesWithStats(): Promise<{
    predefinedThemes: { name: string; usageCount: number }[];
    customThemes: { name: string; usageCount: number }[];
    totalThemes: number;
  }> {
    // Get predefined themes with usage counts
    const predefinedThemes = Object.values(PredefinedTheme);
    const predefinedWithStats = await Promise.all(
      predefinedThemes.map(async (theme) => {
        const count = await this.generatedClipModel
          .countDocuments({
            theme,
            isCustomTheme: false,
            status: { $ne: GeneratedClipStatus.DISCARDED },
          })
          .exec();
        return { name: theme, usageCount: count };
      }),
    );

    // Get custom themes with usage counts
    const customThemeStats = await this.generatedClipModel
      .aggregate([
        {
          $match: {
            isCustomTheme: true,
            status: { $ne: GeneratedClipStatus.DISCARDED },
          },
        },
        {
          $group: {
            _id: '$theme',
            usageCount: { $sum: 1 },
          },
        },
        {
          $project: {
            name: '$_id',
            usageCount: 1,
            _id: 0,
          },
        },
        { $sort: { name: 1 } },
      ])
      .exec();

    return {
      predefinedThemes: predefinedWithStats.sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      customThemes: customThemeStats,
      totalThemes: predefinedThemes.length + customThemeStats.length,
    };
  }

  /**
   * Get popular themes (most used themes across the system)
   */
  async getPopularThemes(limit: number = 10): Promise<
    {
      theme: string;
      usageCount: number;
      isCustom: boolean;
    }[]
  > {
    const popularThemes = await this.generatedClipModel
      .aggregate([
        {
          $match: {
            status: { $ne: GeneratedClipStatus.DISCARDED },
          },
        },
        {
          $group: {
            _id: {
              theme: '$theme',
              isCustom: '$isCustomTheme',
            },
            usageCount: { $sum: 1 },
          },
        },
        {
          $project: {
            theme: '$_id.theme',
            isCustom: '$_id.isCustom',
            usageCount: 1,
            _id: 0,
          },
        },
        { $sort: { usageCount: -1 } },
        { $limit: limit },
      ])
      .exec();

    return popularThemes;
  }

  /**
   * Get supported AI models for clip generation
   */
  getSupportedModels(): SupportedModelsResponseDto {
    const models = [
      // GPT-4.1 family (latest generation with massive context)
      {
        id: OpenAIModel.GPT_4_1_MINI,
        name: 'GPT-4.1 Mini',
        description:
          'Latest model with 1M context window - handles any video transcript without truncation',
        maxTokens: this.getModelTokenLimit(OpenAIModel.GPT_4_1_MINI),
        isRecommended: true,
      },

      // GPT-4o family (proven generation)
      {
        id: OpenAIModel.GPT_4O_MINI,
        name: 'GPT-4o Mini',
        description:
          'Fast, cost-effective model with 128K context - excellent for clip generation',
        maxTokens: this.getModelTokenLimit(OpenAIModel.GPT_4O_MINI),
        isRecommended: true,
      },
      {
        id: OpenAIModel.GPT_4O,
        name: 'GPT-4o',
        description:
          'Multimodal model with superior performance across all tasks',
        maxTokens: this.getModelTokenLimit(OpenAIModel.GPT_4O),
        isRecommended: false,
      },

      // GPT-5 family (future - preview only)
      {
        id: OpenAIModel.GPT_5,
        name: 'GPT-5 (Preview)',
        description:
          'Next-generation model with 400K context - currently in preview',
        maxTokens: this.getModelTokenLimit(OpenAIModel.GPT_5),
        isRecommended: false,
      },

      // GPT-4 family (previous generation)
      {
        id: OpenAIModel.GPT_4_TURBO,
        name: 'GPT-4 Turbo',
        description: 'High-performance model with extended context window',
        maxTokens: this.getModelTokenLimit(OpenAIModel.GPT_4_TURBO),
        isRecommended: false,
      },
      {
        id: OpenAIModel.GPT_4,
        name: 'GPT-4',
        description: 'Advanced model with high-quality clip generation',
        maxTokens: this.getModelTokenLimit(OpenAIModel.GPT_4),
        isRecommended: false,
      },

      // GPT-3.5 family (cost-effective)
      {
        id: OpenAIModel.GPT_3_5_TURBO,
        name: 'GPT-3.5 Turbo',
        description: 'Cost-effective model for basic clip generation needs',
        maxTokens: this.getModelTokenLimit(OpenAIModel.GPT_3_5_TURBO),
        isRecommended: false,
      },
      {
        id: OpenAIModel.GPT_3_5_TURBO_16K,
        name: 'GPT-3.5 Turbo 16K',
        description:
          'Extended context version of GPT-3.5 for longer transcripts',
        maxTokens: this.getModelTokenLimit(OpenAIModel.GPT_3_5_TURBO_16K),
        isRecommended: false,
      },
    ];

    return {
      models,
      defaultModel: OpenAIModel.GPT_4_1_MINI,
    };
  }

  /**
   * Validate if a model is supported
   */
  isSupportedModel(model: string): boolean {
    return Object.values(OpenAIModel).includes(model as OpenAIModel);
  }

  /**
   * Private helper methods
   */

  private async validateThemeLimit(
    projectId: string,
    newTheme: string,
  ): Promise<void> {
    const existingThemes = await this.getThemesForProject(projectId);

    // If theme already exists, it's ok (for regeneration)
    if (existingThemes.includes(newTheme)) {
      return;
    }

    // Check if we're at the limit of 3 themes
    if (existingThemes.length >= 3) {
      throw new BadRequestException(
        `Maximum of 3 themes allowed per project. Current themes: ${existingThemes.join(', ')}`,
      );
    }
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

  /**
   * Convert seconds to SRT timestamp
   */
  private secondsToSrt(seconds: number): string {
    const ms = Math.round((seconds % 1) * 1000);
    const total = Math.floor(seconds);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${pad(hh)}:${pad(mm)}:${pad(ss)},${String(ms).padStart(3, '0')}`;
  }

  /**
   * Convert ClipRecipe to AIClipRequest format
   */
  private convertClipRecipeToAIClipRequest(recipe: ClipRecipe): AIClipRequest {
    // Get the timestamp segments from either timestamps or segments field
    const timestampSegments = recipe.timestamps || recipe.segments || [];
    // Convert timestamps to segments and filter out segments longer than 60 seconds
    const validTimestamps = timestampSegments.filter((ts) => {
      // Calculate actual duration
      const startTime = this.srtToSeconds(ts.start_str);
      const endTime = this.srtToSeconds(ts.end_str);
      const duration = endTime - startTime;

      // Check if segment is within acceptable duration limits (max 60 seconds)
      if (duration > 90) {
        this.logger.warn(
          `Filtered out segment "${ts.label}" - duration ${duration.toFixed(2)}s exceeds 60s limit`,
        );
        return false;
      }

      return true;
    });

    // If no timestamps provided, return empty segments
    if (validTimestamps.length === 0) {
      this.logger.warn(`No segments found for clip "${recipe.title}"`);
      return {
        title: recipe.title || 'Untitled Clip',
        description: recipe.description || 'No description provided',
        segments: [],
        hashtags: [],
        confidence: 0.5,
        keywords: [recipe.theme_category || 'unknown'],
        reasoning: 'No valid segments found',
        totalDuration: 0,
      };
    }

    // Convert valid timestamps to segments
    const segments: LogicalSegment[] = validTimestamps.map((ts, index) => {
      // Keep timestamps in original HH:MM:SS,mmm format
      const startTime = ts.start_str;
      const endTime = ts.end_str;

      // Determine segment purpose based on position
      let purpose: 'hook' | 'build' | 'payoff' = 'build';
      if (index === 0) purpose = 'hook';
      else if (index === validTimestamps.length - 1) purpose = 'payoff';

      return {
        startTime,
        endTime,
        purpose,
      };
    });

    // Calculate total duration (convert to seconds only for calculation)
    const totalDuration = segments.reduce((sum, segment) => {
      const startSeconds = this.srtToSeconds(segment.startTime);
      const endSeconds = this.srtToSeconds(segment.endTime);
      return sum + (endSeconds - startSeconds);
    }, 0);

    return {
      title: recipe.title,
      description: recipe.description,
      segments,
      hashtags: [], // Not included in new format
      confidence: 0.95, // Default high confidence
      keywords: [recipe.theme_category], // Use theme as keyword
      reasoning: `Created from theme: ${recipe.theme_category}`,
      totalDuration,
    };
  }

  private async callOpenAIForClipGeneration(
    theme: string,
    srtEntries: SRTEntry[],
    maxClips: number,
    model: OpenAIModel,
  ): Promise<AIClipRequest[]> {
    if (!this.openai) {
      throw new Error('OpenAI service is not configured');
    }

    try {
      const aiProcessed = await this.processSingleTranscript(
        theme,
        srtEntries,
        maxClips,
        model,
      );

      return aiProcessed;
    } catch (error) {
      this.logger.error('Error calling OpenAI for clip generation:', error);
      throw error;
    }
  }

  private async saveGeneratedClips(
    projectId: string,
    theme: string,
    isCustomTheme: boolean,
    generationId: string,
    aiClips: AIClipRequest[],
    srtEntries: any[],
  ): Promise<GeneratedClip[]> {
    const clips: GeneratedClip[] = [];

    for (let i = 0; i < aiClips.length; i++) {
      const aiClip = aiClips[i];

      // Check if this is a Franken-Clip (has multiple segments)
      const isFrankenClip = aiClip.segments && aiClip.segments.length > 1;

      let timeStamp;
      const segments = [];
      let totalDuration = 0;
      let fullTranscript = '';

      if (isFrankenClip) {
        // Handle Franken-Clips with multiple segments
        for (let segIndex = 0; segIndex < aiClip.segments.length; segIndex++) {
          const segment = aiClip.segments[segIndex];

          // Extract transcript for this segment
          const segmentSrtEntries = srtEntries.filter(
            (entry) =>
              entry.startSeconds >= segment.startTime &&
              entry.endSeconds <= segment.endTime,
          );
          const segmentTranscript = segmentSrtEntries
            .map((entry) => entry.text)
            .join(' ');

          // Calculate duration in seconds for storage
          const startSeconds = this.srtToSeconds(segment.startTime);
          const endSeconds = this.srtToSeconds(segment.endTime);
          const segmentDuration = endSeconds - startSeconds;

          segments.push({
            startTime: segment.startTime, // Already in HH:MM:SS,mmm format
            endTime: segment.endTime, // Already in HH:MM:SS,mmm format
            duration: segmentDuration, // Duration in seconds
            purpose: segment.purpose,
            sequenceOrder: segIndex + 1,
          });

          totalDuration += segmentDuration;
          fullTranscript +=
            (fullTranscript ? ' [...] ' : '') + segmentTranscript;
        }

        // For timeStamp (backward compatibility), use the full span
        const firstSegment = aiClip.segments[0];
        const lastSegment = aiClip.segments[aiClip.segments.length - 1];
        timeStamp = {
          startTime: firstSegment.startTime,
          endTime: lastSegment.endTime,
          duration: totalDuration, // Use actual combined duration
        };

        // Log discrepancy if AI's totalDuration doesn't match calculated
        if (
          aiClip.totalDuration &&
          Math.abs(aiClip.totalDuration - totalDuration) > 1
        ) {
          this.logger.warn(
            `AI provided totalDuration ${aiClip.totalDuration}s but calculated ${totalDuration}s for clip "${aiClip.title}"`,
          );
        }
      } else {
        // Handle traditional single-segment clips (backward compatibility)
        const startTime = aiClip.segments?.[0]?.startTime || '00:00:00,000';
        const endTime = aiClip.segments?.[0]?.endTime || '00:00:30,000';

        // Convert to seconds for duration calculation and SRT filtering
        const startSeconds = this.srtToSeconds(startTime);
        const endSeconds = this.srtToSeconds(endTime);

        timeStamp = {
          startTime: startSeconds,
          endTime: endSeconds,
          duration: endSeconds - startSeconds,
        };

        // Extract transcript for single segment
        const relevantSrtEntries = srtEntries.filter(
          (entry) =>
            entry.startSeconds >= startSeconds &&
            entry.endSeconds <= endSeconds,
        );
        fullTranscript =
          relevantSrtEntries.map((entry) => entry.text).join(' ') || '';
      }

      const generatedClip = new this.generatedClipModel({
        projectId,
        theme,
        isCustomTheme,
        generationId,
        clipSequence: i + 1,
        title: aiClip.title,
        description: aiClip.description,
        timeStamp,
        segments,
        totalDuration: isFrankenClip ? totalDuration : undefined,
        isFrankenClip,
        transcript: fullTranscript,
        aiMetadata: {
          confidence: aiClip.confidence || 0.8,
          keywords: aiClip.keywords || [],
          reasoning: aiClip.reasoning,
          hashtags: aiClip.hashtags || [],
        },
        status: GeneratedClipStatus.PENDING,
        generatedAt: new Date(),
      });

      const savedClip = await generatedClip.save();
      clips.push(savedClip);
    }

    return clips;
  }

  /**
   * Process a single transcript (or chunk) through OpenAI
   */
  private async processSingleTranscript(
    theme: string,
    srtEntries: SRTEntry[],
    maxClips: number,
    model: OpenAIModel,
  ): Promise<AIClipRequest[]> {
    const systemPrompt = this.buildSystemPrompt(
      theme,
      maxClips,
      JSON.stringify(srtEntries),
    );

    const completion = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }],
      response_format: { type: 'json_object' } as any,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    return this.parseOpenAIResponse(responseContent);
  }

  /**
   * Parse OpenAI JSON response with improved error handling
   */
  private parseOpenAIResponse(responseContent: string): AIClipRequest[] {
    let clipRecipes: ClipRecipe[];

    try {
      this.logger.debug('Raw OpenAI response:', responseContent);

      // Clean the response content
      const cleanContent = responseContent
        .trim()
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '');

      // Parse the JSON response
      const parsedResponse = JSON.parse(cleanContent);
      this.logger.debug('Parsed response structure:', parsedResponse);

      // Handle different response formats
      if (Array.isArray(parsedResponse)) {
        clipRecipes = parsedResponse;
      } else if (parsedResponse && typeof parsedResponse === 'object') {
        if (parsedResponse.criteria && Array.isArray(parsedResponse.criteria)) {
          this.logger.log('Detected criteria array format');
          clipRecipes = parsedResponse.criteria;
        } else if (
          parsedResponse.output &&
          Array.isArray(parsedResponse.output)
        ) {
          this.logger.log('Detected output array format');
          clipRecipes = parsedResponse.output;
        } else if (
          parsedResponse.clips &&
          Array.isArray(parsedResponse.clips)
        ) {
          this.logger.log('Detected clips array format');
          clipRecipes = parsedResponse.clips;
        } else if (parsedResponse.error) {
          // Handle OpenAI error responses
          throw new Error(`OpenAI Error: ${parsedResponse.error}`);
        } else {
          this.logger.log(
            'Received single clip recipe object, converting to array',
          );
          clipRecipes = [parsedResponse];
        }
      } else {
        throw new Error('Response is not a valid clip recipe format');
      }

      // Convert ClipRecipe format to AIClipRequest format
      const clips = clipRecipes.map((recipe) =>
        this.convertClipRecipeToAIClipRequest(recipe),
      );

      this.logger.debug('Successfully parsed clips:', clips);
      return clips;
    } catch (parseError) {
      this.logger.error('Failed to parse OpenAI JSON response:', parseError);
      this.logger.error('Raw response content:', responseContent);

      // Try fallback parsing
      try {
        const frankenClipsMatch = responseContent.match(
          /"franken_clips"\s*:\s*(\[[\s\S]*?\])/,
        );
        if (frankenClipsMatch && frankenClipsMatch[1]) {
          clipRecipes = JSON.parse(frankenClipsMatch[1]);
          this.logger.warn(
            'Fallback parsing succeeded with franken_clips extraction',
          );
          return clipRecipes.map((recipe) =>
            this.convertClipRecipeToAIClipRequest(recipe),
          );
        }

        const arrayMatch = responseContent.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          clipRecipes = JSON.parse(arrayMatch[0]);
          this.logger.warn('Fallback parsing succeeded with array extraction');
          return clipRecipes.map((recipe) =>
            this.convertClipRecipeToAIClipRequest(recipe),
          );
        }

        throw parseError;
      } catch (fallbackError) {
        throw new Error(
          `Invalid JSON response from OpenAI: ${parseError.message}`,
        );
      }
    }
  }

  /**
   * Get token limit for different models
   */
  private getModelTokenLimit(model: OpenAIModel): number {
    switch (model) {
      // GPT-4.1 family (1M context)
      case OpenAIModel.GPT_4_1_MINI:
        return 1000000;
      // GPT-4o Mini (high context)
      case OpenAIModel.GPT_4O_MINI:
        return 128000;

      // GPT-5 family (400K context)
      case OpenAIModel.GPT_5:
        return 400000;

      // GPT-4o family
      case OpenAIModel.GPT_4O:
      case OpenAIModel.GPT_4O_MINI:
        return 128000;

      // GPT-4 family
      case OpenAIModel.GPT_4_TURBO:
      case OpenAIModel.GPT_4_TURBO_PREVIEW:
        return 128000;
      case OpenAIModel.GPT_4:
      case OpenAIModel.GPT_4_0613:
        return 8192;
      case OpenAIModel.GPT_4_32K:
      case OpenAIModel.GPT_4_32K_0613:
        return 32768;

      // GPT-3.5 family
      case OpenAIModel.GPT_3_5_TURBO:
      case OpenAIModel.GPT_3_5_TURBO_1106:
      case OpenAIModel.GPT_3_5_TURBO_0613:
        return 4096;
      case OpenAIModel.GPT_3_5_TURBO_16K:
      case OpenAIModel.GPT_3_5_TURBO_16K_0613:
        return 16385;

      default:
        return 4096; // Conservative default
    }
  }

  /**
   * Extract keywords from theme for relevance scoring
   */
  private extractThemeKeywords(theme: string): string[] {
    // Convert theme to lowercase and extract meaningful words
    const commonWords = new Set([
      'the',
      'and',
      'or',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
    ]);

    return theme
      .toLowerCase()
      .split(/[\s,.\-()]+/)
      .filter((word) => word.length > 2 && !commonWords.has(word));
  }
}
