import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserDocument } from '../../schemas/user.schema';
import { ClipsService } from '../clips.service';
import { OpenAIService } from '../services/openai.service';
import {
  CreateClipProjectWithSrtDto,
  ClipProjectResponseDto,
  ClipListResponseDto,
  ClipQueryDto,
  UpdateClipProjectDto,
  ThemeAnalysisResponseDto,
} from '../dto/clips.dto';

@ApiTags('clip-projects')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('clips')
export class ClipProjectController {
  private readonly logger = new Logger(ClipProjectController.name);

  constructor(
    private readonly clipsService: ClipsService,
    private readonly openaiService: OpenAIService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new clip project',
    description:
      'Create a new clip project with title, SRT file, and video source',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Project details with title, video source, and SRT file',
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Project name',
          example: 'My Podcast Episode',
        },
        videoUrl: {
          type: 'string',
          description: 'Direct video file URL or AWS S3 URL',
          example: 'https://bucket.s3.amazonaws.com/videos/my-video.mp4',
        },
        srtFile: {
          type: 'string',
          format: 'binary',
          description: 'SRT subtitle file',
        },
      },
      required: ['title', 'videoUrl', 'srtFile'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Clip project created successfully',
    type: ClipProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or file format',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'srtFile', maxCount: 1 }]))
  async createClipProject(
    @CurrentUser() user: UserDocument,
    @UploadedFiles()
    files: {
      srtFile?: Express.Multer.File[];
    },
    @Body() body: CreateClipProjectWithSrtDto,
  ): Promise<ClipProjectResponseDto> {
    this.logger.log(`User ${user.email} creating clip project: ${body.title}`);

    // Validate video URL is provided
    if (!body.videoUrl || body.videoUrl.trim().length === 0) {
      throw new BadRequestException('Video URL is required');
    }

    // Validate SRT file is provided
    if (!files.srtFile || files.srtFile.length === 0) {
      throw new BadRequestException('SRT file is required');
    }

    const srtFile = files.srtFile[0];

    // Validate SRT file
    if (!this.isValidSRTFile(srtFile)) {
      throw new BadRequestException('Invalid SRT file format');
    }

    return this.clipsService.createClipProject({
      title: body.title,
      videoUrl: body.videoUrl,
      srtContent: srtFile.buffer.toString('utf-8'),
      srtFileName: srtFile.originalname,
      userId: user._id.toString(),
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Get all clip projects',
    description: 'Get all clip projects with pagination',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'List of clip projects',
    type: ClipListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getClipProjects(
    @CurrentUser() user: UserDocument,
    @Query() queryDto: ClipQueryDto,
  ): Promise<ClipListResponseDto> {
    this.logger.log(`User ${user.email} getting clip projects`);
    return this.clipsService.getClipProjects(queryDto, user._id.toString());
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get clip project details',
    description: 'Get detailed information about a specific clip project',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Clip project details',
    type: ClipProjectResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Clip project not found',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getClipProject(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
  ): Promise<ClipProjectResponseDto> {
    this.logger.log(`User ${user.email} getting clip project: ${clipId}`);
    return this.clipsService.getClipProject(clipId, user._id.toString());
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update clip project',
    description: 'Update clip project with generated clips and timestamps',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiBody({
    description: 'Update clip project data',
    type: UpdateClipProjectDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Clip project updated successfully',
    type: ClipProjectResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Clip project not found',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async updateClipProject(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Body() updateDto: UpdateClipProjectDto,
  ): Promise<ClipProjectResponseDto> {
    this.logger.log(`User ${user.email} updating clip project ${clipId}`);
    return this.clipsService.updateClipProject(
      clipId,
      updateDto,
      user._id.toString(),
    );
  }

  @Get(':id/analyze-themes')
  @ApiOperation({
    summary: 'Analyze themes in clip project SRT content',
    description:
      'Extract themes from the SRT content using AI analysis (no data stored)',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiResponse({
    status: 200,
    description: 'Themes analyzed successfully',
    type: ThemeAnalysisResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Clip project not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Project does not have SRT content or analysis failed',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async analyzeThemes(
    @CurrentUser() user: UserDocument,
    @Param('id') projectId: string,
  ): Promise<ThemeAnalysisResponseDto> {
    this.logger.log(
      `User ${user.email} analyzing themes for project ${projectId}`,
    );

    // Get project data to access SRT content
    const project = await this.clipsService.getRawClipData(
      projectId,
      user._id.toString(),
    );

    if (!project.srtContent) {
      throw new BadRequestException(
        'Project does not have SRT content to analyze',
      );
    }

    // Analyze themes using OpenAI
    const themes = await this.openaiService.extractThemeNames(
      project.srtContent,
    );

    this.logger.log(
      `Successfully analyzed ${themes.length} themes for project ${projectId}`,
    );

    return {
      themes,
      totalThemes: themes.length,
      projectId,
      analyzedAt: new Date(),
    };
  }

  /**
   * Validate SRT file format
   */
  private isValidSRTFile(file: Express.Multer.File): boolean {
    const allowedMimeTypes = ['text/plain', 'application/x-subrip'];
    const allowedExtensions = ['.srt'];
    const extension = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf('.'));

    return (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(extension)
    );
  }
}
