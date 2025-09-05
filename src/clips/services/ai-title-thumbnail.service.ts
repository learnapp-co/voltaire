import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';
import {
  AIModel,
  TitleTone,
  Clip,
  ClipDocument,
} from '../../schemas/clip.schema';

// Interface for generated titles/thumbnails
export interface GeneratedTitleThumbnail {
  titles: string[];
  thumbnailHeaders: string[];
}

@Injectable()
export class AITitleThumbnailService {
  private readonly logger = new Logger(AITitleThumbnailService.name);
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    @InjectModel(Clip.name) private clipModel: Model<ClipDocument>,
  ) {
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
   * Generate titles and thumbnail headers based on clip project ID and selected tones
   */
  async generateTitlesThumbnails(
    clipId: string,
    selectedTones: string[],
    aiModel: AIModel,
  ): Promise<GeneratedTitleThumbnail> {
    this.logger.log(
      `Generating titles and thumbnails for clip project ${clipId} using ${aiModel} with tones: ${selectedTones.join(', ')}`,
    );

    // Fetch clip project from database
    const clip = await this.clipModel.findById(clipId);
    if (!clip) {
      throw new NotFoundException(`Clip project with ID ${clipId} not found`);
    }

    // Extract clip data
    const clipTitle = clip.title;
    const clipDescription = clip.description || '';
    const clipTranscript = clip.srtContent || '';

    if (!clipTranscript) {
      throw new BadRequestException(
        'No SRT content found for this clip project. Please upload an SRT file first.',
      );
    }

    this.logger.log(
      `Using clip "${clipTitle}" with ${clipTranscript.length} characters of transcript`,
    );

    switch (aiModel) {
      case AIModel.GPT_4O:
        return this.generateWithOpenAI(
          clipTitle,
          clipDescription,
          clipTranscript,
          selectedTones,
        );
      // case AIModel.CLAUDE:
      //   return this.generateWithClaude(
      //     clipTitle,
      //     clipDescription,
      //     clipTranscript,
      //     selectedTones,
      //   );
      // case AIModel.GEMINI:
      //   return this.generateWithGemini(
      //     clipTitle,
      //     clipDescription,
      //     clipTranscript,
      //     selectedTones,
      //   );
      default:
        throw new BadRequestException(`Unsupported AI model: ${aiModel}`);
    }
  }

  /**
   * Generate titles and thumbnails using OpenAI GPT-4o
   */
  private async generateWithOpenAI(
    clipTitle: string,
    clipDescription: string,
    clipTranscript: string,
    selectedTones: string[],
  ): Promise<GeneratedTitleThumbnail> {
    if (!this.openai) {
      throw new BadRequestException('OpenAI is not configured');
    }

    const titleSystemPrompt = this.buildTitleSystemPrompt(
      clipTitle,
      clipDescription,
      clipTranscript,
      selectedTones,
    );

    const thumbnailSystemPrompt = this.buildThumbnailSystemPrompt(
      clipTitle,
      clipDescription,
      clipTranscript,
      selectedTones,
    );

    try {
      // Generate titles
      const titleCompletion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: titleSystemPrompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });

      // Generate thumbnail headers
      const thumbnailCompletion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: thumbnailSystemPrompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const titleResponse = titleCompletion.choices[0]?.message?.content;
      const thumbnailResponse =
        thumbnailCompletion.choices[0]?.message?.content;

      if (!titleResponse || !thumbnailResponse) {
        throw new Error('No response from OpenAI');
      }

      const titles = this.parseMarkdownTable(titleResponse);
      const thumbnailHeaders = this.parseMarkdownTable(thumbnailResponse);

      return {
        titles,
        thumbnailHeaders,
      };
    } catch (error) {
      this.logger.error('Error generating with OpenAI:', error);
      throw new BadRequestException('Failed to generate with OpenAI');
    }
  }

  /**
   * Generate titles and thumbnails using Claude (placeholder implementation)
   * TODO: Implement actual Claude API integration
   */
  private async generateWithClaude(
    clipTitle: string,
    clipDescription: string,
    clipTranscript: string,
    selectedTones: string[],
  ): Promise<GeneratedTitleThumbnail> {
    this.logger.warn('Claude integration not yet implemented, using mock data');

    // Mock response for now - replace with actual Claude API integration
    return this.generateMockResponse(selectedTones);
  }

  /**
   * Generate titles and thumbnails using Gemini (placeholder implementation)
   * TODO: Implement actual Gemini API integration
   */
  private async generateWithGemini(
    clipTitle: string,
    clipDescription: string,
    clipTranscript: string,
    selectedTones: string[],
  ): Promise<GeneratedTitleThumbnail> {
    this.logger.warn('Gemini integration not yet implemented, using mock data');

    // Mock response for now - replace with actual Gemini API integration
    return this.generateMockResponse(selectedTones);
  }

  /**
   * Build the system prompt for title generation
   */
  private buildTitleSystemPrompt(
    clipTitle: string,
    clipDescription: string,
    clipTranscript: string,
    selectedTones: string[],
  ): string {
    return `ROLE AND GOAL:
You are an expert viral content strategist based in Noida, specializing in writing high-engagement, "scroll-stopping" titles for YouTube Shorts. Your goal is to generate 15-20 powerful titles based on the provided video context and strategic parameters.

CONTEXT OF THE VIDEO:
---
CLIP TITLE: ${clipTitle}
CLIP DESCRIPTION: ${clipDescription}

FULL TRANSCRIPT:
${clipTranscript}
---

STRATEGIC PARAMETERS:
- **Desired Tone/Style:** ${selectedTones.join(', ')}

TITLE GENERATION STRATEGIES TO USE:
1. **Punchline / Reveal:** Drop a surprising or bold fact early (e.g., "50% of My Income Comes from Social Media?!")
2. **Controversial Opinion:** Spark debate or strong reactions (e.g., "Freelancing Is Dead – Here's Why")
3. **Clear Outcome / Result:** Show tangible success or transformation (e.g., "How I Made ₹10L in 6 Months Freelancing")
4. **Problem Statement:** Call out a relatable pain point (e.g., "Struggling to Get Clients? Watch This.")
5. **Contradiction / Irony:** Challenge common assumptions (e.g., "Clients Pay Less Than My Instagram Posts Do")
6. **Curiosity Hook:** Create an information gap people want to close (e.g., "I Did THIS Before Every Big Client Deal")
7. **Secret / Hidden Strategy:** Tease insider tips or unknown hacks (e.g., "The Tool No Freelancer Talks About")
8. **Urgency / FOMO:** Build pressure to act now or miss out (e.g., "Do This Before It's Too Late!")
9. **List or Framework:** Use structure like steps, tips, or tools (e.g., "3 Steps to Build a High-Income Side Hustle")
10. **Transformation / Before-After:** Show clear change over time or effort (e.g., "From ₹0 to ₹1L/Month in 90 Days")
11. **Emotional Trigger:** Use words that evoke strong feelings (e.g., "My Biggest Failure")
12. **Direct Question:** Ask a question the audience wants answered (e.g., "Is This The Future?")
13. **Surprising/Unexpected:** Surprise the audience with a surprising fact or statement (e.g., "I'm a Mentalist")
14. **Motivational:** Motivate the audience to take action (e.g., "Don't Let Fear Hold You Back")
15. **Nostalgic/Sentimental:** Evoke nostalgia or sentimentality (e.g., "The Best Advice I Ever Got")
16. **Aspirational / Luxurious:** Inspire the audience to aspire to something (e.g., "The Best Way to Make Money")
17. **Intriguing/Mysterious:** Intrigue the audience with a mysterious or intriguing statement (e.g., "The Secret to Success")
18. **Urgent/Timely:** Create a sense of urgency or timeliness (e.g., "Do This Before It's Too Late!")

INSTRUCTIONS:
Your final output must be ONLY a Markdown table with two columns: "Strategy" and "Suggested Title". Do not include any other text, explanation, or introduction.`;
  }

  /**
   * Build the system prompt for thumbnail header generation
   */
  private buildThumbnailSystemPrompt(
    clipTitle: string,
    clipDescription: string,
    clipTranscript: string,
    selectedTones: string[],
  ): string {
    return `ROLE AND GOAL:
You are an expert YouTube Thumbnail Text strategist. Your goal is to create 10-15 powerful, high-impact headers for a YouTube Short thumbnail. The headers must be concise but also highly specific and intriguing to maximize click-through rates. They should be visually scannable in 1-2 seconds.

CRITICAL CONTEXT OF THE VIDEO (Generated from Transcript):
---
CLIP TITLE: ${clipTitle}
CLIP DESCRIPTION: ${clipDescription}

FULL TRANSCRIPT:
${clipTranscript}
---

STRATEGIC PARAMETERS:
- **Audience & Tone:** ${selectedTones.join(', ')}

GUIDING PRINCIPLES (You MUST follow these):
1.  **BE HYPER-SPECIFIC:** This is the most important rule. You MUST incorporate specific names, numbers, keywords, or unique concepts from the context above.
    -   **BAD (Generic):** "Feeling Overwhelmed?"
    -   **GOOD (Specific):** "Overwhelmed by Finances?"
    -   **BAD (Generic):** "The Best Advice I Ever Got"
    -   **GOOD (Specific):** "Tanmay Bhatt's Best Advice"
2.  **FOCUS ON TRANSFORMATION & OUTCOME:** Frame the headers around a clear "before & after" or a tangible result.
    -   **BAD (Generic):** "Get Organized Now"
    -   **GOOD (Specific):** "From Confused To Clear" or "My Finances In 1 Sheet"
3.  **LEVERAGE AUTHORITY/PERSONALITY:** If a specific person or brand is mentioned in the context (like 'Tanmay Bhatt'), use their name directly in the headers to build credibility and curiosity.
4.  **THINK VISUALLY (LINES OF TEXT):** While the headers should be short, don't be afraid to use 2-3 extra words if it adds crucial context. Imagine how the text would break into lines on a thumbnail.
    -   Example: "TANMAY'S SECRET // TO FIXING FINANCES" is more powerful than "The Financial Secret".

HEADER STRATEGIES TO USE (Apply the principles above to these strategies):
- **Problem/Solution:** (e.g., "Finances A Mess? Try This.")
- **Curiosity Gap:** (e.g., "Tanmay Bhatt's 1-Sheet Secret")
- **Bold Statement:** (e.g., "This Excel Sheet Changed My Life")
- **Result-Oriented:** (e.g., "Clarity In 15 Minutes")
- **Emotional Trigger:** (e.g., "I Was So Lost With Money")
- **Direct Question:** (e.g., "Need Financial Clarity?")
- **Surprising/Unexpected:** (e.g., "My Mentor? Tanmay Bhatt.")
- **Motivational:** (e.g., "Stop Feeling Stuck With Money")
- **Nostalgic/Sentimental:** (e.g., "The Advice That Saved Me")
- **Aspirational:** (e.g., "Your Path To Financial Freedom")
- **Intriguing/Mysterious:** (e.g., "The Secret The Rich Use")
- **Urgent/Timely:** (e.g., "Fix Your Finances NOW")

INSTRUCTIONS:
Your final output must be ONLY a Markdown table with two columns: "Strategy" and "Suggested Header". Do not include any other text, preamble, or explanation.`;
  }

  /**
   * Parse markdown table response to extract titles or headers
   */
  private parseMarkdownTable(responseContent: string): string[] {
    try {
      const lines = responseContent.trim().split('\n');
      const contentLines = [];

      // Skip header and separator lines, extract content
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines, headers, and separator lines
        if (
          !line ||
          (line.startsWith('|') &&
            (line.includes('Strategy') || line.includes('---')))
        ) {
          continue;
        }

        // Parse table rows
        if (line.startsWith('|')) {
          const columns = line
            .split('|')
            .map((col) => col.trim())
            .filter((col) => col);
          if (columns.length >= 2) {
            // Take the second column (Suggested Title/Header)
            contentLines.push(columns[1]);
          }
        }
      }

      if (contentLines.length === 0) {
        this.logger.warn(
          'No content found in markdown table, falling back to line extraction',
        );

        // Fallback: try to extract any content that looks like titles/headers
        const fallbackContent = lines
          .filter(
            (line) =>
              line.trim() &&
              !line.includes('Strategy') &&
              !line.includes('---'),
          )
          .map((line) => line.replace(/^\|?\s*/, '').replace(/\s*\|?$/, ''))
          .filter((line) => line.length > 5) // Filter out very short content
          .slice(0, 20); // Max 20 items

        return fallbackContent;
      }

      this.logger.log(
        `Parsed ${contentLines.length} items from markdown table`,
      );
      return contentLines.slice(0, 20); // Ensure max 20 items
    } catch (error) {
      this.logger.error('Failed to parse markdown table:', error);
      this.logger.debug('Raw response:', responseContent);
      throw new BadRequestException('Failed to parse markdown table response');
    }
  }

  /**
   * Generate mock response for testing and placeholder implementations
   */
  private generateMockResponse(
    selectedTones: string[],
  ): GeneratedTitleThumbnail {
    // Mock titles using the 18 viral strategies (20 total)
    const mockTitles = [
      '50% of My Income Comes From This One Skill!', // Punchline/Reveal
      'Why Traditional Career Advice is Dead Wrong', // Controversial Opinion
      'How I Made ₹10L in 6 Months From Zero', // Clear Outcome/Result
      'Struggling With Productivity? This Changes Everything', // Problem Statement
      'Clients Pay Less Than My Instagram Posts Do', // Contradiction/Irony
      'I Did THIS Before Every Big Client Deal', // Curiosity Hook
      'The Tool No Freelancer Talks About', // Secret/Hidden Strategy
      "Do This Before It's Too Late!", // Urgency/FOMO
      '3 Steps to Build a High-Income Side Hustle', // List/Framework
      'From Broke to ₹1L/Month in 90 Days', // Transformation/Before-After
      'My Biggest Failure Taught Me This Secret', // Emotional Trigger
      'Is This The Future of Work?', // Direct Question
      "I'm Actually A Productivity Mentalist", // Surprising/Unexpected
      "Don't Let Fear Hold You Back", // Motivational
      'The Best Advice I Ever Got', // Nostalgic/Sentimental
      'The Best Way to Make Money Online', // Aspirational/Luxurious
      'The Secret to Success Nobody Talks About', // Intriguing/Mysterious
      'Fix Your Career Before Monday!', // Urgent/Timely
      'Why 90% of People Fail at This', // Additional Controversial
      'The Mindset Shift That Changed Everything', // Additional Transformation
    ];

    // Mock thumbnail headers using specific viral header strategies
    const mockThumbnailHeaders = [
      'PRODUCTIVITY EXPOSED',
      'FREELANCER SECRET',
      '₹10L METHOD',
      'CAREER GAME OVER',
      'SKILL BREAKDOWN',
      'FIX THIS NOW',
      'YOUR FUTURE',
      'TRADITIONAL VS NEW',
      'WARNING: OUTDATED',
      'SUCCESS CODE',
      'WHY FREELANCE?',
      'HOW TO SCALE?',
      'INCOME BREAKTHROUGH',
      'INSTANT CLARITY',
      'HIDDEN STRATEGY',
      'VIRAL INCOME TRICK',
      'MIND = BLOWN',
      'BEFORE/AFTER INCOME',
      'DANGER: OLD ADVICE',
      'ULTIMATE FREEDOM',
    ];

    // Tone-specific variations
    const primaryTone = selectedTones[0] || 'Motivational';
    let toneModifiedTitles = [...mockTitles];

    if (primaryTone.includes('Educational')) {
      toneModifiedTitles = [
        '5 Steps That Changed My Entire Career Path',
        'How To Master Any Skill in 30 Days',
        'The Complete Guide to Freelancing Success',
        ...mockTitles.slice(3),
      ];
    } else if (primaryTone.includes('Controversial')) {
      toneModifiedTitles = [
        'Why Hard Work is a Scam (Proof Inside)',
        "College is Dead - Here's What Actually Works",
        'The Freelancing Myth Everyone Believes',
        ...mockTitles.slice(3),
      ];
    }

    return {
      titles: toneModifiedTitles,
      thumbnailHeaders: mockThumbnailHeaders,
    };
  }

  /**
   * Get available AI models
   */
  getAvailableModels(): AIModel[] {
    return Object.values(AIModel);
  }

  /**
   * Get available tones
   */
  getAvailableTones(): TitleTone[] {
    return Object.values(TitleTone);
  }

  /**
   * Validate tone selection
   */
  validateTones(tones: string[]): boolean {
    const availableTones = Object.values(TitleTone);
    return tones.every(
      (tone) => availableTones.includes(tone as TitleTone) || tone.length <= 20,
    );
  }
}
