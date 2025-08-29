import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAIModel } from '../../schemas/clip.schema';
import { GeneratedClipDto } from '../dto/clips.dto';

// Local interface for backward compatibility (not used in simplified API)
interface ThemeDto {
  title: string;
  description: string;
  angle: string;
  confidence: number;
  keywords?: string[];
  timeRanges?: number[];
}

export interface SRTEntry {
  index: number;
  startTime: string;
  endTime: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI;

  // OpenAI pricing per 1K tokens (as of latest known rates)
  private readonly PRICING = {
    [OpenAIModel.GPT_4_MINI]: {
      input: 0.00015, // $0.15 per 1M tokens
      output: 0.0006, // $0.60 per 1M tokens
    },
    [OpenAIModel.GPT_4]: {
      input: 0.03, // $30 per 1M tokens
      output: 0.06, // $60 per 1M tokens
    },
    [OpenAIModel.GPT_4_TURBO]: {
      input: 0.01, // $10 per 1M tokens
      output: 0.03, // $30 per 1M tokens
    },
  };

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'OpenAI API key not found. OpenAI services will not be available.',
      );
    } else {
      this.openai = new OpenAI({
        apiKey,
      });
    }
  }

  /**
   * Parse SRT content into structured entries
   */
  parseSRT(srtContent: string): SRTEntry[] {
    const entries: SRTEntry[] = [];
    const blocks = srtContent.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      const index = parseInt(lines[0], 10);
      if (isNaN(index)) {
        continue;
      }

      const timePattern =
        /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/;
      const timeMatch = lines[1].match(timePattern);
      if (!timeMatch) continue;

      const startTime = timeMatch[1];
      const endTime = timeMatch[2];
      const text = lines.slice(2).join(' ').trim();

      entries.push({
        index,
        startTime,
        endTime,
        startSeconds: this.timeToSeconds(startTime),
        endSeconds: this.timeToSeconds(endTime),
        text,
      });
    }

    return entries;
  }

  /**
   * Convert SRT time format to seconds
   */
  private timeToSeconds(timeStr: string): number {
    const [time, milliseconds] = timeStr.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds + Number(milliseconds) / 1000;
  }

  /**
   * Convert seconds to SRT time format
   */
  private secondsToTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds
      .toString()
      .padStart(3, '0')}`;
  }

  /**
   * Analyze themes from SRT content using OpenAI
   */
  async analyzeThemes(
    srtContent: string,
    model: OpenAIModel = OpenAIModel.GPT_4_MINI,
  ): Promise<{ themes: ThemeDto[] }> {
    if (!this.openai) {
      throw new Error('OpenAI service is not configured');
    }

    try {
      const srtEntries = this.parseSRT(srtContent);
      const transcript = srtEntries.map((entry) => entry.text).join(' ');

      const systemPrompt = `You are an expert content analyst specializing in identifying themes and topics from video transcripts. Your task is to analyze the provided transcript and identify the main themes, topics, and angles discussed.

For each theme you identify, provide:
1. A concise, engaging title
2. A detailed description of what's discussed
3. The specific angle or perspective taken
4. A confidence score (0-1) based on how prominent this theme is
5. Key keywords associated with the theme
6. Time ranges where this theme is most relevant (if identifiable)

Focus on themes that would make engaging, standalone video clips. Consider:
- Educational value
- Entertainment potential
- Viral potential
- Clear narrative arc
- Strong opinions or insights
- Actionable advice
- Controversial or thought-provoking content

Return your analysis as a JSON array of themes.`;

      const userPrompt = `Analyze this video transcript and identify 3-7 main themes that would make great video clips:

TRANSCRIPT:
${transcript}

Return the analysis as a JSON array with this exact structure:
[
  {
    "title": "Theme Title",
    "description": "Detailed description of the theme",
    "angle": "The specific angle or perspective",
    "confidence": 0.85,
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "timeRanges": [startSeconds, endSeconds]
  }
]

Make sure the JSON is valid and properly formatted.`;

      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      let themes: ThemeDto[];
      try {
        const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          themes = JSON.parse(jsonMatch[0]);
        } else {
          themes = JSON.parse(responseContent);
        }
      } catch (parseError) {
        this.logger.error('Failed to parse OpenAI JSON response:', parseError);
        throw new Error('Invalid JSON response from OpenAI');
      }

      return { themes };
    } catch (error) {
      this.logger.error('Error analyzing themes:', error);
      throw error;
    }
  }

  /**
   * Generate clips based on selected theme
   */
  async generateClips(
    srtContent: string,
    selectedTheme: ThemeDto,
    clipCount: number,
    model: OpenAIModel = OpenAIModel.GPT_4_MINI,
  ): Promise<{ clips: GeneratedClipDto[] }> {
    if (!this.openai) {
      throw new Error('OpenAI service is not configured');
    }

    try {
      const srtEntries = this.parseSRT(srtContent);
      const transcript = srtEntries
        .map((entry) => {
          return `[${this.secondsToTime(entry.startSeconds)} -> ${this.secondsToTime(entry.endSeconds)}] ${entry.text}`;
        })
        .join('\n');

      const systemPrompt = `You are an expert video editor and content creator specializing in creating engaging short-form video clips from longer content. Your task is to identify and extract the best clips based on a specific theme.

For each clip, provide:
1. An engaging, hook-worthy title
2. A compelling description that would work for social media
3. Exact start and end timestamps (in seconds)
4. The transcript text for that timeframe
5. Relevant hashtags for social media

Focus on creating clips that:
- Have a clear beginning, middle, and end
- Are 30-120 seconds long (optimal for social media)
- Have strong hooks in the first 3 seconds
- Contain complete thoughts or stories
- Are self-contained and don't require additional context
- Have emotional impact or educational value
- Include any memorable quotes or insights

Use the provided timestamps to ensure accuracy.`;

      const userPrompt = `Based on the theme "${selectedTheme.title}" (${selectedTheme.description}), create ${clipCount} engaging video clips from this timestamped transcript.

THEME FOCUS: ${selectedTheme.angle}
KEYWORDS: ${selectedTheme.keywords?.join(', ') || 'N/A'}

TIMESTAMPED TRANSCRIPT:
${transcript}

Return exactly ${clipCount} clips as a JSON array with this structure:
[
  {
    "title": "Engaging Clip Title",
    "description": "Compelling description for social media",
    "startTime": startTimeInSeconds,
    "endTime": endTimeInSeconds,
    "duration": durationInSeconds,
    "transcript": "The exact transcript text for this timeframe",
    "hashtags": ["#relevant", "#hashtags", "#forsocial"]
  }
]

Ensure:
- Timestamps are accurate and within the transcript timeframe
- Clips are 30-120 seconds long
- Each clip is self-contained
- Titles are engaging and clickable
- JSON is valid and properly formatted`;

      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 3000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      let clips: GeneratedClipDto[];
      try {
        const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          clips = JSON.parse(jsonMatch[0]);
        } else {
          clips = JSON.parse(responseContent);
        }
      } catch (parseError) {
        this.logger.error('Failed to parse OpenAI JSON response:', parseError);
        throw new Error('Invalid JSON response from OpenAI');
      }

      // Validate and set generation timestamp
      clips = clips.map((clip) => ({
        ...clip,
        generatedAt: new Date(),
      }));

      return { clips };
    } catch (error) {
      this.logger.error('Error generating clips:', error);
      throw error;
    }
  }

  /**
   * Get video duration from SRT content
   */
  getVideoDurationFromSRT(srtContent: string): number {
    const entries = this.parseSRT(srtContent);
    if (entries.length === 0) return 0;

    const lastEntry = entries[entries.length - 1];
    return lastEntry.endSeconds;
  }

  /**
   * Validate SRT content format
   */
  validateSRTContent(srtContent: string): { isValid: boolean; error?: string } {
    try {
      const entries = this.parseSRT(srtContent);

      if (entries.length === 0) {
        return { isValid: false, error: 'No valid SRT entries found' };
      }

      // Check for basic structure
      for (const entry of entries.slice(0, 5)) {
        // Check first 5 entries
        if (!entry.text || entry.text.trim().length === 0) {
          return { isValid: false, error: 'Empty subtitle text found' };
        }
        if (entry.startSeconds >= entry.endSeconds) {
          return {
            isValid: false,
            error: 'Invalid time range in subtitle entry',
          };
        }
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid SRT format' };
    }
  }
}
