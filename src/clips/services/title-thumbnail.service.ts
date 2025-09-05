import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clip, ClipDocument, AIModel } from '../../schemas/clip.schema';
import {
  GeneratedClip,
  GeneratedClipDocument,
} from '../../schemas/generated-clip.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { CollaboratorService } from './collaborator.service';
import { AITitleThumbnailService } from './ai-title-thumbnail.service';
import {
  GenerateTitlesDto,
  GenerateThumbnailHeadersDto,
  AddCustomTitleDto,
  AddCustomThumbnailHeaderDto,
  TitleThumbnailStatusDto,
  GeneratedTitleResponseDto,
  GeneratedThumbnailHeaderResponseDto,
  TitleGenerationResponseDto,
  ThumbnailHeaderGenerationResponseDto,
  TitlePollStatusDto,
  ThumbnailPollStatusDto,
  VoteDetailResponseDto,
} from '../dto/title-thumbnail.dto';

@Injectable()
export class TitleThumbnailService {
  private readonly logger = new Logger(TitleThumbnailService.name);

  constructor(
    @InjectModel(Clip.name) private clipModel: Model<ClipDocument>,
    @InjectModel(GeneratedClip.name)
    private generatedClipModel: Model<GeneratedClipDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private collaboratorService: CollaboratorService,
    private aiTitleThumbnailService: AITitleThumbnailService,
  ) {}

  /**
   * Generate titles for a specific clip
   */
  async generateTitles(
    generatedClipId: string,
    generateDto: GenerateTitlesDto,
    userId: string,
  ): Promise<TitleGenerationResponseDto> {
    // Get generated clip
    const generatedClip =
      await this.generatedClipModel.findById(generatedClipId);
    if (!generatedClip) {
      throw new NotFoundException('Generated clip not found');
    }

    // Verify user access to the project
    await this.collaboratorService.verifyUserAccess(
      generatedClip.projectId.toString(),
      userId,
    );

    // Prepare tones (include custom tone if provided)
    const allTones = [...generateDto.selectedTones];
    if (generateDto.customTone) {
      allTones.push(generateDto.customTone);
    }

    // Validate tones
    if (!this.aiTitleThumbnailService.validateTones(allTones)) {
      throw new BadRequestException('Invalid tone selection');
    }

    try {
      // Generate titles using AI service
      const generated =
        await this.aiTitleThumbnailService.generateTitlesThumbnails(
          generatedClip.projectId.toString(),
          allTones,
          generateDto.aiModel,
        );

      // Initialize title/thumbnail generation if not exists
      if (!generatedClip.titleThumbnailGeneration) {
        generatedClip.titleThumbnailGeneration = {
          generatedTitles: [],
          generatedThumbnailHeaders: [],
          selectedTones: [],
          selectedAIModel: AIModel.GPT_4O,
          titleVoting: {
            isPollActive: false,
            isPollClosed: false,
            isSaved: false,
            votes: [],
            pollOptions: [],
          },
          thumbnailVoting: {
            isPollActive: false,
            isPollClosed: false,
            isSaved: false,
            votes: [],
            pollOptions: [],
          },
          isComplete: false,
        };
      }

      // Update selected tones and AI model
      generatedClip.titleThumbnailGeneration.selectedTones = allTones;
      generatedClip.titleThumbnailGeneration.selectedAIModel =
        generateDto.aiModel;

      // Add generated titles
      const newTitles = generated.titles.map((titleText, index) => ({
        _id: undefined, // Let MongoDB generate IDs
        text: titleText,
        tone: allTones[index % allTones.length], // Distribute across tones
        aiModel: generateDto.aiModel,
        generatedAt: new Date(),
        isCustom: false,
      }));

      generatedClip.titleThumbnailGeneration.generatedTitles.push(...newTitles);

      await generatedClip.save();

      // Convert to response format
      const titles = newTitles.map((title) => ({
        id: (title as any)._id?.toString() || 'temp_id',
        text: title.text,
        tone: title.tone,
        aiModel: title.aiModel,
        generatedAt: title.generatedAt,
        isCustom: title.isCustom,
      }));

      this.logger.log(
        `Generated ${titles.length} titles for clip ${generatedClipId} using ${generateDto.aiModel}`,
      );

      return {
        titles,
        totalGenerated: titles.length,
      };
    } catch (error) {
      this.logger.error(
        `Error generating titles for clip ${generatedClipId}:`,
        error,
      );
      throw new BadRequestException('Failed to generate titles');
    }
  }

  /**
   * Generate thumbnail headers for a specific clip
   */
  async generateThumbnailHeaders(
    generatedClipId: string,
    generateDto: GenerateThumbnailHeadersDto,
    userId: string,
  ): Promise<ThumbnailHeaderGenerationResponseDto> {
    // Get generated clip
    const generatedClip =
      await this.generatedClipModel.findById(generatedClipId);
    if (!generatedClip) {
      throw new NotFoundException('Generated clip not found');
    }

    // Verify user access to the project
    await this.collaboratorService.verifyUserAccess(
      generatedClip.projectId.toString(),
      userId,
    );

    // Prepare tones (include custom tone if provided)
    const allTones = [...generateDto.selectedTones];
    if (generateDto.customTone) {
      allTones.push(generateDto.customTone);
    }

    // Validate tones
    if (!this.aiTitleThumbnailService.validateTones(allTones)) {
      throw new BadRequestException('Invalid tone selection');
    }

    try {
      // Generate thumbnail headers using AI service
      const generated =
        await this.aiTitleThumbnailService.generateTitlesThumbnails(
          generatedClip.projectId.toString(),
          allTones,
          generateDto.aiModel,
        );

      // Initialize title/thumbnail generation if not exists
      if (!generatedClip.titleThumbnailGeneration) {
        generatedClip.titleThumbnailGeneration = {
          generatedTitles: [],
          generatedThumbnailHeaders: [],
          selectedTones: [],
          selectedAIModel: AIModel.GPT_4O,
          titleVoting: {
            isPollActive: false,
            isPollClosed: false,
            isSaved: false,
            votes: [],
            pollOptions: [],
          },
          thumbnailVoting: {
            isPollActive: false,
            isPollClosed: false,
            isSaved: false,
            votes: [],
            pollOptions: [],
          },
          isComplete: false,
        };
      }

      // Update selected tones and AI model
      generatedClip.titleThumbnailGeneration.selectedTones = allTones;
      generatedClip.titleThumbnailGeneration.selectedAIModel =
        generateDto.aiModel;

      // Add generated thumbnail headers
      const newHeaders = generated.thumbnailHeaders.map(
        (headerText, index) => ({
          _id: undefined, // Let MongoDB generate IDs
          text: headerText,
          tone: allTones[index % allTones.length], // Distribute across tones
          aiModel: generateDto.aiModel,
          generatedAt: new Date(),
          isCustom: false,
        }),
      );

      generatedClip.titleThumbnailGeneration.generatedThumbnailHeaders.push(
        ...newHeaders,
      );

      await generatedClip.save();

      // Convert to response format
      const thumbnailHeaders = newHeaders.map((header) => ({
        id: (header as any)._id?.toString() || 'temp_id',
        text: header.text,
        tone: header.tone,
        aiModel: header.aiModel,
        generatedAt: header.generatedAt,
        isCustom: header.isCustom,
      }));

      this.logger.log(
        `Generated ${thumbnailHeaders.length} thumbnail headers for clip ${generatedClipId} using ${generateDto.aiModel}`,
      );

      return {
        thumbnailHeaders,
        totalGenerated: thumbnailHeaders.length,
      };
    } catch (error) {
      this.logger.error(
        `Error generating thumbnail headers for clip ${generatedClipId}:`,
        error,
      );
      throw new BadRequestException('Failed to generate thumbnail headers');
    }
  }

  /**
   * Add custom title
   */
  async addCustomTitle(
    generatedClipId: string,
    customTitleDto: AddCustomTitleDto,
    userId: string,
  ): Promise<GeneratedTitleResponseDto> {
    // Get generated clip
    const generatedClip =
      await this.generatedClipModel.findById(generatedClipId);
    if (!generatedClip) {
      throw new NotFoundException('Generated clip not found');
    }

    // Verify user access to the project
    await this.collaboratorService.verifyUserAccess(
      generatedClip.projectId.toString(),
      userId,
    );

    // Initialize title/thumbnail generation if not exists
    if (!generatedClip.titleThumbnailGeneration) {
      generatedClip.titleThumbnailGeneration = {
        generatedTitles: [],
        generatedThumbnailHeaders: [],
        selectedTones: [],
        selectedAIModel: AIModel.GPT_4O,
        titleVoting: {
          isPollActive: false,
          isPollClosed: false,
          isSaved: false,
          votes: [],
          pollOptions: [],
        },
        thumbnailVoting: {
          isPollActive: false,
          isPollClosed: false,
          isSaved: false,
          votes: [],
          pollOptions: [],
        },
        isComplete: false,
      };
    }

    // Add custom title
    const customTitle = {
      _id: undefined,
      text: customTitleDto.text,
      tone: customTitleDto.tone,
      aiModel: AIModel.GPT_4O, // Default for custom entries
      generatedAt: new Date(),
      isCustom: true,
    };

    generatedClip.titleThumbnailGeneration.generatedTitles.push(customTitle);

    await generatedClip.save();

    this.logger.log(
      `Added custom title for clip ${generatedClipId}: "${customTitleDto.text}"`,
    );

    return {
      id: (customTitle as any)._id?.toString() || 'temp_id',
      text: customTitle.text,
      tone: customTitle.tone,
      aiModel: customTitle.aiModel,
      generatedAt: customTitle.generatedAt,
      isCustom: customTitle.isCustom,
    };
  }

  /**
   * Add custom thumbnail header
   */
  async addCustomThumbnailHeader(
    generatedClipId: string,
    customHeaderDto: AddCustomThumbnailHeaderDto,
    userId: string,
  ): Promise<GeneratedThumbnailHeaderResponseDto> {
    // Get generated clip
    const generatedClip =
      await this.generatedClipModel.findById(generatedClipId);
    if (!generatedClip) {
      throw new NotFoundException('Generated clip not found');
    }

    // Verify user access to the project
    await this.collaboratorService.verifyUserAccess(
      generatedClip.projectId.toString(),
      userId,
    );

    // Initialize title/thumbnail generation if not exists
    if (!generatedClip.titleThumbnailGeneration) {
      generatedClip.titleThumbnailGeneration = {
        generatedTitles: [],
        generatedThumbnailHeaders: [],
        selectedTones: [],
        selectedAIModel: AIModel.GPT_4O,
        titleVoting: {
          isPollActive: false,
          isPollClosed: false,
          isSaved: false,
          votes: [],
          pollOptions: [],
        },
        thumbnailVoting: {
          isPollActive: false,
          isPollClosed: false,
          isSaved: false,
          votes: [],
          pollOptions: [],
        },
        isComplete: false,
      };
    }

    // Add custom thumbnail header
    const customHeader = {
      _id: undefined,
      text: customHeaderDto.text,
      tone: customHeaderDto.tone,
      aiModel: AIModel.GPT_4O, // Default for custom entries
      generatedAt: new Date(),
      isCustom: true,
    };

    generatedClip.titleThumbnailGeneration.generatedThumbnailHeaders.push(
      customHeader,
    );

    await generatedClip.save();

    this.logger.log(
      `Added custom thumbnail header for clip ${generatedClipId}: "${customHeaderDto.text}"`,
    );

    return {
      id: (customHeader as any)._id?.toString() || 'temp_id',
      text: customHeader.text,
      tone: customHeader.tone,
      aiModel: customHeader.aiModel,
      generatedAt: customHeader.generatedAt,
      isCustom: customHeader.isCustom,
    };
  }

  /**
   * Get title and thumbnail status for a clip
   */
  async getTitleThumbnailStatus(
    generatedClipId: string,
    userId: string,
  ): Promise<TitleThumbnailStatusDto> {
    // Get generated clip
    const generatedClip =
      await this.generatedClipModel.findById(generatedClipId);
    if (!generatedClip) {
      throw new NotFoundException('Generated clip not found');
    }

    // Verify user access to the project
    await this.collaboratorService.verifyUserAccess(
      generatedClip.projectId.toString(),
      userId,
    );

    // Initialize if not exists
    if (!generatedClip.titleThumbnailGeneration) {
      generatedClip.titleThumbnailGeneration = {
        generatedTitles: [],
        generatedThumbnailHeaders: [],
        selectedTones: [],
        selectedAIModel: AIModel.GPT_4O,
        titleVoting: {
          isPollActive: false,
          isPollClosed: false,
          isSaved: false,
          votes: [],
          pollOptions: [],
        },
        thumbnailVoting: {
          isPollActive: false,
          isPollClosed: false,
          isSaved: false,
          votes: [],
          pollOptions: [],
        },
        isComplete: false,
      };
    }

    const ttg = generatedClip.titleThumbnailGeneration;

    // Convert titles
    const titles: GeneratedTitleResponseDto[] = ttg.generatedTitles.map(
      (title) => ({
        id: (title as any)._id?.toString() || 'temp_id',
        text: title.text,
        tone: title.tone,
        aiModel: title.aiModel,
        generatedAt: title.generatedAt,
        isCustom: title.isCustom,
      }),
    );

    // Convert thumbnail headers
    const thumbnailHeaders: GeneratedThumbnailHeaderResponseDto[] =
      ttg.generatedThumbnailHeaders.map((header) => ({
        id: (header as any)._id?.toString() || 'temp_id',
        text: header.text,
        tone: header.tone,
        aiModel: header.aiModel,
        generatedAt: header.generatedAt,
        isCustom: header.isCustom,
      }));

    // Convert votes with user details
    const convertVotes = async (
      votes: any[],
    ): Promise<VoteDetailResponseDto[]> => {
      const result = [];
      for (const vote of votes) {
        const user = await this.userModel.findById(vote.userId);
        result.push({
          userId: vote.userId.toString(),
          userEmail: user?.email || 'Unknown',
          votedAt: vote.votedAt,
          selectedOptions: vote.selectedOptions,
        });
      }
      return result;
    };

    const titleVotes = await convertVotes(ttg.titleVoting.votes);
    const thumbnailVotes = await convertVotes(ttg.thumbnailVoting.votes);

    // Title poll status
    const titlePoll: TitlePollStatusDto = {
      isPollActive: ttg.titleVoting.isPollActive,
      pollCreatedAt: ttg.titleVoting.pollCreatedAt,
      pollDeadline: ttg.titleVoting.pollDeadline,
      pollOptions: ttg.titleVoting.pollOptions,
      votes: titleVotes,
      isPollClosed: ttg.titleVoting.isPollClosed,
      finalSelection: ttg.titleVoting.finalSelection,
      isSaved: ttg.titleVoting.isSaved,
    };

    // Thumbnail poll status
    const thumbnailPoll: ThumbnailPollStatusDto = {
      isPollActive: ttg.thumbnailVoting.isPollActive,
      pollCreatedAt: ttg.thumbnailVoting.pollCreatedAt,
      pollDeadline: ttg.thumbnailVoting.pollDeadline,
      pollOptions: ttg.thumbnailVoting.pollOptions,
      votes: thumbnailVotes,
      isPollClosed: ttg.thumbnailVoting.isPollClosed,
      finalSelection: ttg.thumbnailVoting.finalSelection,
      isSaved: ttg.thumbnailVoting.isSaved,
    };

    const canMoveToNextMilestone =
      ttg.titleVoting.isSaved && ttg.thumbnailVoting.isSaved && ttg.isComplete;

    return {
      titles,
      thumbnailHeaders,
      selectedTones: ttg.selectedTones,
      selectedAIModel: ttg.selectedAIModel,
      titlePoll,
      thumbnailPoll,
      isComplete: ttg.isComplete,
      canMoveToNextMilestone,
    };
  }

  // Additional methods for poll creation, voting, and final selection will be added here
  // This is a partial implementation focusing on the core generation functionality
}
