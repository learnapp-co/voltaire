import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserDocument } from '../../schemas/user.schema';
import { ClipsService } from '../clips.service';
import { ClipProcessingService } from '../services/clip-processing.service';
import { AIClipGenerationService } from '../services/ai-clip-generation.service';
import { OpenAIModel, ClipMilestone } from '../../schemas/clip.schema';
import {
  GenerateClipsForThemeDto,
  ThemeGenerationResponseDto,
  ThemeClipDto,
  SupportedModelsResponseDto,
  EditAIClipRequestDto,
  EditAIClipResponseDto,
  ClipEditValidationErrorDto,
  AIGeneratedClipDto,
  ArchiveClipResponseDto,
  ArchivedClipsQueryDto,
  ArchivedClipsResponseDto,
  ArchivedClipDto,
} from '../dto/clips.dto';

@ApiTags('ai-clips')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('clips')
export class AIClipController {
  private readonly logger = new Logger(AIClipController.name);

  constructor(
    private readonly clipsService: ClipsService,
    private readonly clipProcessingService: ClipProcessingService,
    private readonly aiClipGenerationService: AIClipGenerationService,
  ) {}

  @Get('models/supported')
  @ApiOperation({
    summary: 'Get supported AI models',
    description:
      'Get list of supported AI models for clip generation with their specifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Supported models retrieved successfully',
    type: SupportedModelsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getSupportedModels(): Promise<SupportedModelsResponseDto> {
    return this.aiClipGenerationService.getSupportedModels();
  }

  @Post(':id/themes/generate')
  @ApiOperation({
    summary: 'Generate AI clips for a theme',
    description:
      'Generate up to 20 AI clips for a specific theme with automatic video processing',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiBody({
    description: 'Theme generation request',
    type: GenerateClipsForThemeDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Clips generated and processed successfully',
    type: ThemeGenerationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request or theme limit reached (max 3 themes per project)',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async generateClipsForTheme(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
    @Body() generateDto: GenerateClipsForThemeDto,
  ): Promise<ThemeGenerationResponseDto> {
    this.logger.log(
      `User ${user.email} generating clips for theme "${generateDto.theme}" in project ${projectId}`,
    );

    // Get project data including srtContent
    const project = await this.clipsService.getRawClipData(
      projectId,
      user._id.toString(),
    );
    if (!project.srtContent) {
      throw new BadRequestException('Project does not have SRT content');
    }

    // Automatically determine if theme is custom by checking predefined themes
    const predefinedThemes = this.aiClipGenerationService.getPredefinedThemes();
    const isCustomTheme = !predefinedThemes.includes(generateDto.theme);

    const request = {
      projectId,
      theme: generateDto.theme,
      isCustomTheme,
      maxClips: generateDto.maxClips || 20,
      model: generateDto.model || OpenAIModel.GPT_4_1_MINI,
    };

    // Set processing defaults - quality matches raw file, format always mp4
    const processingOptions = {
      quality: 'medium' as const, // Use same quality as raw file
      format: 'mp4' as const, // Always mp4 format
      includeFades: false, // No fades by default
    };

    const result =
      await this.clipProcessingService.generateAndProcessClipsForTheme(
        request,
        project.srtContent,
        processingOptions,
      );

    // Fetch the actual generated clips from database with all segment data
    const generatedClips = await this.clipProcessingService.getClipsByTheme(
      projectId,
      generateDto.theme,
    );

    // Map the result to our DTO format with complete data
    return {
      generationId: result.generationId,
      theme: result.theme,
      totalClips: result.totalClips,
      processedClips: result.processedClips,
      failedClips: result.failedClips,
      clips: generatedClips.map((clip) => this.mapClipToDto(clip)),
    };
  }

  @Get(':id/themes')
  @ApiOperation({
    summary: 'Get all themes with their clips data',
    description: 'Get all themes and their associated clips for a project',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiResponse({
    status: 200,
    description: 'All themes with clips retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          example: '60d5ecb74f3b2c001f5e4e8a',
        },
        totalThemes: {
          type: 'number',
          example: 3,
        },
        totalClips: {
          type: 'number',
          example: 15,
        },
        themes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              theme: {
                type: 'string',
                example: 'Money',
              },
              isCustomTheme: {
                type: 'boolean',
                example: false,
              },
              clipCount: {
                type: 'number',
                example: 5,
              },
              clips: {
                type: 'array',
                items: { $ref: '#/components/schemas/ThemeClipDto' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getAllThemesWithClips(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
  ): Promise<{
    projectId: string;
    totalThemes: number;
    totalClips: number;
    themes: Array<{
      theme: string;
      isCustomTheme: boolean;
      clipCount: number;
      clips: ThemeClipDto[];
    }>;
  }> {
    this.logger.log(
      `User ${user.email} getting all themes with clips for project ${projectId}`,
    );

    // Check if user has access to this project
    await this.clipsService.getClipProject(projectId, user._id.toString());

    // Get all themes for the project
    const allThemes =
      await this.aiClipGenerationService.getThemesForProject(projectId);
    const predefinedThemes = this.aiClipGenerationService.getPredefinedThemes();

    const themes = [];
    let totalClips = 0;

    // Get clips for each theme
    for (const theme of allThemes) {
      const clips = await this.clipProcessingService.getClipsByTheme(
        projectId,
        theme,
      );
      const mappedClips = clips.map((clip) => this.mapClipToDto(clip));

      themes.push({
        theme,
        isCustomTheme: !predefinedThemes.includes(theme),
        clipCount: mappedClips.length,
        clips: mappedClips,
      });

      totalClips += mappedClips.length;
    }

    return {
      projectId,
      totalThemes: themes.length,
      totalClips,
      themes,
    };
  }

  @Get(':id/themes/:theme/clips')
  @ApiOperation({
    summary: 'Get clips for a specific theme',
    description: 'Get all clips for the specified theme in a project',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'theme',
    description: 'Theme name',
    example: 'Money',
  })
  @ApiResponse({
    status: 200,
    description: 'Theme clips retrieved successfully',
    type: [ThemeClipDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getClipsByTheme(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
    @Param('theme') theme: string,
  ): Promise<ThemeClipDto[]> {
    this.logger.log(
      `User ${user.email} getting clips for theme "${theme}" in project ${projectId}`,
    );

    // Check if user has access to this project and get project data
    const clipProject = await this.clipsService.getClipProject(
      projectId,
      user._id.toString(),
    );

    const clips = await this.clipProcessingService.getClipsByTheme(
      projectId,
      theme,
    );

    return clips.map((clip) =>
      this.mapClipToDto(clip, clipProject.rawFile.url),
    );
  }

  @Get(':id/ai-clips/:clipId')
  @ApiOperation({
    summary: 'Get AI-generated clip for editing',
    description:
      'Retrieve a specific AI-generated clip with all details for editing',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'clipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e9b',
  })
  @ApiResponse({
    status: 200,
    description: 'AI-generated clip retrieved successfully',
    type: AIGeneratedClipDto,
  })
  @ApiResponse({
    status: 404,
    description: 'AI-generated clip not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getAIClipForEditing(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
  ): Promise<AIGeneratedClipDto> {
    this.logger.log(
      `User ${user.email} getting AI clip ${clipId} for editing in project ${projectId}`,
    );

    // Check if user has access to this project and get project data
    const clipProject = await this.clipsService.getClipProject(
      projectId,
      user._id.toString(),
    );

    const clip = await this.clipProcessingService.getAIClipById(
      projectId,
      clipId,
    );

    return this.mapGeneratedClipToDto(clip, clipProject.rawFile.url);
  }

  @Put(':id/ai-clips/:clipId')
  @ApiOperation({
    summary: 'Edit AI-generated clip',
    description:
      'Update an AI-generated clip with modified segments and regenerate video',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'clipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e9b',
  })
  @ApiBody({
    description: 'Updated clip data',
    type: EditAIClipRequestDto,
  })
  @ApiResponse({
    status: 200,
    description: 'AI-generated clip updated successfully',
    type: EditAIClipResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or validation errors',
    type: ClipEditValidationErrorDto,
  })
  @ApiResponse({
    status: 404,
    description: 'AI-generated clip not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async editAIClip(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
    @Body() editRequest: EditAIClipRequestDto,
  ): Promise<EditAIClipResponseDto> {
    this.logger.log(
      `User ${user.email} editing AI clip ${clipId} in project ${projectId}`,
    );

    // Check if user has access to this project
    await this.clipsService.getClipProject(projectId, user._id.toString());

    // Process the edit request
    const updatedClip = await this.clipProcessingService.editAIClip(
      projectId,
      clipId,
      editRequest,
    );

    return this.mapEditedClipToResponseDto(updatedClip);
  }

  @Patch(':id/ai-clips/:clipId/archive')
  @ApiOperation({
    summary: 'Archive AI-generated clip',
    description: 'Archive an AI-generated clip to hide it from main listings',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'clipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e9b',
  })
  @ApiResponse({
    status: 200,
    description: 'Clip archived successfully',
    type: ArchiveClipResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Clip is already archived',
  })
  @ApiResponse({
    status: 404,
    description: 'AI-generated clip not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async archiveAIClip(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
  ): Promise<ArchiveClipResponseDto> {
    this.logger.log(
      `User ${user.email} archiving AI clip ${clipId} in project ${projectId}`,
    );

    // Check if user has access to this project
    await this.clipsService.getClipProject(projectId, user._id.toString());

    // Archive the clip
    const archivedClip = await this.clipProcessingService.archiveAIClip(
      projectId,
      clipId,
      user._id.toString(),
    );

    return {
      success: true,
      message: 'Clip archived successfully',
      isArchived: archivedClip.isArchived,
      archivedAt: archivedClip.archivedAt,
    };
  }

  @Patch(':id/ai-clips/:clipId/unarchive')
  @ApiOperation({
    summary: 'Unarchive AI-generated clip',
    description:
      'Unarchive an AI-generated clip to restore it to main listings',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'clipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e9b',
  })
  @ApiResponse({
    status: 200,
    description: 'Clip unarchived successfully',
    type: ArchiveClipResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Clip is not archived',
  })
  @ApiResponse({
    status: 404,
    description: 'AI-generated clip not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async unarchiveAIClip(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
    @Param('clipId') clipId: string,
  ): Promise<ArchiveClipResponseDto> {
    this.logger.log(
      `User ${user.email} unarchiving AI clip ${clipId} in project ${projectId}`,
    );

    // Check if user has access to this project
    await this.clipsService.getClipProject(projectId, user._id.toString());

    // Unarchive the clip
    const unarchivedClip = await this.clipProcessingService.unarchiveAIClip(
      projectId,
      clipId,
    );

    return {
      success: true,
      message: 'Clip unarchived successfully',
      isArchived: unarchivedClip.isArchived,
      archivedAt: unarchivedClip.archivedAt,
    };
  }

  @Get(':id/archived-clips')
  @ApiOperation({
    summary: 'Get archived AI clips',
    description:
      'Retrieve all archived AI-generated clips for a project with filtering and pagination',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiResponse({
    status: 200,
    description: 'Archived clips retrieved successfully',
    type: ArchivedClipsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getArchivedClips(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
    @Query() query: ArchivedClipsQueryDto,
  ): Promise<ArchivedClipsResponseDto> {
    this.logger.log(
      `User ${user.email} getting archived clips for project ${projectId}`,
    );

    // Check if user has access to this project
    await this.clipsService.getClipProject(projectId, user._id.toString());

    // Get archived clips with pagination and filtering
    const result = await this.clipProcessingService.getArchivedClips(
      projectId,
      query,
    );

    // Map to response DTOs
    const clips = result.clips.map((clip) => this.mapArchivedClipToDto(clip));

    return {
      clips,
      totalClips: result.totalClips,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      limit: result.limit,
    };
  }

  /**
   * Helper method to map GeneratedClip to ThemeClipDto with all segments
   */
  private mapClipToDto(clip: any, rawClipUrl?: string): ThemeClipDto {
    return {
      id: clip._id?.toString() || '',
      clipSequence: clip.clipSequence,
      title: clip.title,
      description: clip.description,
      timeStamp: clip.timeStamp,
      segments: clip.segments || [],
      totalDuration: clip.totalDuration,
      isFrankenClip: clip.isFrankenClip || false,
      transcript: clip.transcript,
      aiMetadata: clip.aiMetadata,
      videoUrl: clip.videoUrl,
      rawClipUrl: rawClipUrl || clip.rawClipUrl,
      fileSize: clip.fileSize,
      status: clip.status,
      processingError: clip.processingError,
      generatedAt: clip.generatedAt || new Date(),
      milestone: clip.milestone || ClipMilestone.RAW_CLIP,
      processingCompletedAt: clip.processingCompletedAt,
    };
  }

  /**
   * Helper method to map GeneratedClip to AIGeneratedClipDto for editing
   */
  private mapGeneratedClipToDto(
    clip: any,
    rawClipUrl?: string,
  ): AIGeneratedClipDto {
    return {
      id: clip._id?.toString() || '',
      projectId: clip.projectId?.toString() || '',
      theme: clip.theme,
      isCustomTheme: clip.isCustomTheme || false,
      generationId: clip.generationId,
      clipSequence: clip.clipSequence,
      title: clip.title,
      description: clip.description,
      timeStamp: clip.timeStamp,
      segments: clip.segments || [],
      totalDuration: clip.totalDuration,
      isFrankenClip: clip.isFrankenClip || false,
      transcript: clip.transcript,
      aiMetadata: clip.aiMetadata,
      videoUrl: clip.videoUrl,
      rawClipUrl: rawClipUrl || clip.rawClipUrl,
      fileName: clip.fileName,
      fileSize: clip.fileSize,
      status: clip.status,
      processingError: clip.processingError,
      isLiked: clip.isLiked || false,
      isBookmarked: clip.isBookmarked || false,
      viewCount: clip.viewCount || 0,
      isArchived: clip.isArchived || false,
      archivedAt: clip.archivedAt,
      archivedBy: clip.archivedBy?.email,
      refinementHistory: clip.refinementHistory || [],
      originalTimeStamp: clip.originalTimeStamp,
      awsMetadata: clip.awsMetadata,
      generatedAt: clip.generatedAt || new Date(),
      processingStartedAt: clip.processingStartedAt,
      processingCompletedAt: clip.processingCompletedAt,
      lastRefinedAt: clip.lastRefinedAt,
      titleThumbnailGeneration: clip.titleThumbnailGeneration,
      metadata: clip.metadata || {},
      createdAt: clip.createdAt || new Date(),
      updatedAt: clip.updatedAt || new Date(),
    };
  }

  /**
   * Helper method to map edited clip to response DTO
   */
  private mapEditedClipToResponseDto(clip: any): EditAIClipResponseDto {
    return {
      id: clip._id?.toString() || '',
      title: clip.title,
      description: clip.description,
      segments:
        clip.segments?.map((segment: any) => ({
          startTime: segment.startTime,
          endTime: segment.endTime,
          duration: segment.duration,
          purpose: segment.purpose,
          sequenceOrder: segment.sequenceOrder,
        })) || [],
      totalDuration: clip.totalDuration || 0,
      status: clip.status,
      videoUrl: clip.videoUrl,
      lastEditedAt: clip.lastRefinedAt || clip.updatedAt || new Date(),
      refinementHistory: clip.refinementHistory || [],
    };
  }

  /**
   * Helper method to map GeneratedClip to ArchivedClipDto
   */
  private mapArchivedClipToDto(clip: any): ArchivedClipDto {
    return {
      id: clip._id?.toString() || '',
      title: clip.title,
      description: clip.description,
      theme: clip.theme,
      clipSequence: clip.clipSequence,
      totalDuration: clip.totalDuration || 0,
      videoUrl: clip.videoUrl || '',
      archivedAt: clip.archivedAt || new Date(),
      archivedBy: clip.archivedBy?.email || 'Unknown',
      generatedAt: clip.generatedAt || new Date(),
    };
  }
}
