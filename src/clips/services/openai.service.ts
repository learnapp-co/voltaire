import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAIModel } from '../../schemas/clip.schema';

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
    // GPT-4.1 family (latest with 1M context)
    [OpenAIModel.GPT_4_1_MINI]: {
      input: 0.00015, // $0.15 per 1M tokens (estimated, similar to GPT-4o-mini)
      output: 0.0006, // $0.60 per 1M tokens (estimated, similar to GPT-4o-mini)
    },

    // GPT-4o family (latest, most efficient)
    [OpenAIModel.GPT_4O]: {
      input: 0.005, // $5 per 1M tokens
      output: 0.015, // $15 per 1M tokens
    },
    [OpenAIModel.GPT_4O_MINI]: {
      input: 0.00015, // $0.15 per 1M tokens
      output: 0.0006, // $0.60 per 1M tokens
    },

    // GPT-4 family (high-performance)
    [OpenAIModel.GPT_4_TURBO]: {
      input: 0.01, // $10 per 1M tokens
      output: 0.03, // $30 per 1M tokens
    },
    [OpenAIModel.GPT_4_TURBO_PREVIEW]: {
      input: 0.01, // $10 per 1M tokens
      output: 0.03, // $30 per 1M tokens
    },
    [OpenAIModel.GPT_4]: {
      input: 0.03, // $30 per 1M tokens
      output: 0.06, // $60 per 1M tokens
    },
    [OpenAIModel.GPT_4_0613]: {
      input: 0.03, // $30 per 1M tokens
      output: 0.06, // $60 per 1M tokens
    },
    [OpenAIModel.GPT_4_32K]: {
      input: 0.06, // $60 per 1M tokens
      output: 0.12, // $120 per 1M tokens
    },
    [OpenAIModel.GPT_4_32K_0613]: {
      input: 0.06, // $60 per 1M tokens
      output: 0.12, // $120 per 1M tokens
    },

    // GPT-3.5 family (cost-effective)
    [OpenAIModel.GPT_3_5_TURBO]: {
      input: 0.0005, // $0.50 per 1M tokens
      output: 0.0015, // $1.50 per 1M tokens
    },
    [OpenAIModel.GPT_3_5_TURBO_16K]: {
      input: 0.003, // $3 per 1M tokens
      output: 0.004, // $4 per 1M tokens
    },
    [OpenAIModel.GPT_3_5_TURBO_1106]: {
      input: 0.001, // $1 per 1M tokens
      output: 0.002, // $2 per 1M tokens
    },
    [OpenAIModel.GPT_3_5_TURBO_0613]: {
      input: 0.0015, // $1.50 per 1M tokens
      output: 0.002, // $2 per 1M tokens
    },
    [OpenAIModel.GPT_3_5_TURBO_16K_0613]: {
      input: 0.003, // $3 per 1M tokens
      output: 0.004, // $4 per 1M tokens
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
   * Analyze themes from SRT content using OpenAI
   */
  async analyzeThemes(
    srtContent: string,
    model: OpenAIModel = OpenAIModel.GPT_4_1_MINI,
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

  /**
   * Extract theme names from SRT content using OpenAI
   */
  async extractThemeNames(srtContent: string): Promise<string[]> {
    this.logger.log('Extracting theme names from SRT content using OpenAI');

    const systemPrompt = `You are an expert content analyst. You will parse the SRT transcript provided below and produce a deterministic, exhaustive list of all talk-themes present in the transcript.

PROCESS (must follow exactly):
1. Parse the SRT strictly: preserve timestamps and caption text. Use caption segments as atomic units when counting.
2. Normalize text for analysis only: lowercase; remove punctuation except inside timestamps; perform simple lemmatization (e.g., "invests"→"invest").
3. Build candidate theme signals two ways (both required):
   a) Keyword signals: extract all nouns and noun-phrases (NPs) and high-impact verbs that appear in captions.
   b) Co-occurrence signals: cluster NPs/keywords that frequently appear together in the same caption segment.
4. Create theme candidates by grouping synonyms/very-similar NPs. **Deterministic merging rules:** merge two candidate names if ANY of the following hold:
   - one candidate string is a substring of the other after lemmatization; OR
   - token-overlap ≥ 60% after lemmatization; OR
   - exact keyword-match (same token sequence).
   Resolve any remaining ties by alphabetical order of the candidate name.
5. **Inclusion rule (exhaustive):** include **every** theme that has at least **one** supporting caption segment in the SRT (do not invent themes without SRT evidence). If a candidate has zero exact supporting segments, do not include it.
6. For each included theme compute:
   - Theme name: choose a concise canonical name (title case), prefer commonly used phrase (e.g., "Mindset & Psychology", "Fixed Income").
   - Definition: **short** (max 12 words) one-sentence definition that makes the theme understandable.
   - Segments: the integer count of caption segments where any of that theme's keywords/NPs appear (each segment counted once per theme).
   - EvidenceExcerpts: select up to **2** verbatim caption lines (with their original timestamps) from the SRT that directly prove the theme. Each excerpt must be taken exactly as-is; you may merge two adjacent captions (place them on separate lines) but do not alter text.
7. Ranking & ordering: output themes **sorted by descending Segments**. If Segments tie, sort those themes alphabetically.
8. Determinism requirements:
   - Do not use randomness.
   - Use the exact rules above for merging and sorting.
   - If you cannot find any supporting caption for a candidate, drop it.
9. Output format:
   - Return **only** an array of theme names as strings (no extra commentary).
   - Each element should be just the theme name string.
   - Example: ["Business Strategy", "Personal Development", "Technology", "Finance"]

Return only the array of theme names as strings.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: OpenAIModel.GPT_4_1_MINI,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Analyze this SRT transcript and return themes:\n\n${srtContent}`,
          },
        ],
        temperature: 0, // For deterministic results
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Parse the JSON response
      try {
        const themes = JSON.parse(content);
        if (!Array.isArray(themes)) {
          throw new Error('Expected array of themes from OpenAI');
        }

        // Validate that all themes are strings
        const validThemes = themes.filter(
          (theme) => typeof theme === 'string' && theme.trim().length > 0,
        );

        this.logger.log(
          `Successfully extracted ${validThemes.length} themes from SRT`,
        );
        return validThemes;
      } catch (parseError) {
        this.logger.error(
          'Failed to parse OpenAI response as JSON:',
          parseError,
        );
        throw new Error('Invalid JSON response from OpenAI theme analysis');
      }
    } catch (error) {
      this.logger.error('Error analyzing themes with OpenAI:', error);
      throw new Error(`Theme analysis failed: ${error.message}`);
    }
  }
}
