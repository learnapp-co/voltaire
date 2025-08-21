import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  // UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipeBuilder,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ClipsService } from './clips.service';
import { FileUploadService } from './services/file-upload.service';
import {
  CreateClipProjectDto,
  CreateClipProjectWithSrtDto,
  UploadSrtDto,
  SelectThemeAndGenerateDto,
  ClipProjectResponseDto,
  ThemeAnalysisResponseDto,
  ClipGenerationResponseDto,
  ClipListResponseDto,
  ClipQueryDto,
  MessageResponseDto,
  UploadToSignedUrlRequestDto,
  SignedUrlUploadResponseDto,
  UploadStatusDto,
} from './dto/clips.dto';

@Public()
@ApiTags('clips')
@Controller('clips')
// @UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClipsController {
  private readonly logger = new Logger(ClipsController.name);

  constructor(
    private readonly clipsService: ClipsService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Create a new clip project with SRT file',
    description:
      'Create a new clip project with project name, video source (Google Drive URL OR local file upload), and SRT subtitle file. Theme analysis will start automatically.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Project details and files. Provide either rawFileUrl OR localVideoFile, not both.',
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Project name',
          example: 'Hustle_Mouni_roy_LF',
        },
        rawFileUrl: {
          type: 'string',
          description:
            'Google Drive URL for the video file (optional if localVideoFile is provided)',
          example: 'https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view',
        },
        selectedModel: {
          type: 'string',
          description: 'OpenAI model to use',
          enum: ['gpt-4o-mini', 'gpt-4', 'gpt-4-turbo'],
          default: 'gpt-4o-mini',
        },
        localVideoFile: {
          type: 'string',
          format: 'binary',
          description:
            'Local video file upload (optional if rawFileUrl is provided)',
        },
        srtFile: {
          type: 'string',
          format: 'binary',
          description: 'SRT subtitle file (required)',
        },
      },
      required: ['title', 'srtFile'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Clip project created successfully and theme analysis started',
    type: ClipProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input data, video file, or SRT file. Must provide either rawFileUrl or localVideoFile.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'localVideoFile', maxCount: 1 },
      { name: 'srtFile', maxCount: 1 },
    ]),
  )
  async createClipProjectWithSrt(
    @UploadedFiles()
    files: {
      localVideoFile?: Express.Multer.File[];
      srtFile?: Express.Multer.File[];
    },
    @Body() body: CreateClipProjectWithSrtDto,
    @CurrentUser() user: any,
  ): Promise<ClipProjectResponseDto> {
    // Handle public access (no authentication) with default test user
    const userId = user?.sub || 'test-user-id';
    this.logger.log(
      `Creating clip project with SRT: ${body.title} for user: ${userId}`,
    );

    // Validate that either rawFileUrl or localVideoFile is provided
    const hasGoogleDriveUrl =
      body.rawFileUrl && body.rawFileUrl.trim().length > 0;
    const hasLocalFile =
      files.localVideoFile && files.localVideoFile.length > 0;

    if (!hasGoogleDriveUrl && !hasLocalFile) {
      throw new BadRequestException(
        'Either rawFileUrl (Google Drive URL) or localVideoFile must be provided',
      );
    }

    if (hasGoogleDriveUrl && hasLocalFile) {
      throw new BadRequestException(
        'Provide either rawFileUrl OR localVideoFile, not both',
      );
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

    const uploadSrtDto: UploadSrtDto = {
      srtContent: srtFile.buffer.toString('utf-8'),
      srtFileName: srtFile.originalname,
    };

    if (hasLocalFile) {
      const localVideoFile = files.localVideoFile![0];

      // Validate video file
      if (!this.isValidVideoFile(localVideoFile)) {
        throw new BadRequestException(
          'Invalid video file format. Supported formats: mp4, mov, avi, mkv, wmv',
        );
      }

      return this.clipsService.createClipProjectWithLocalFile(
        body.title,
        localVideoFile,
        uploadSrtDto,
        body.selectedModel,
        userId,
      );
    } else {
      const createClipProjectDto: CreateClipProjectDto = {
        title: body.title,
        rawFileUrl: body.rawFileUrl!,
        selectedModel: body.selectedModel as any,
      };

      return this.clipsService.createClipProjectWithSrt(
        createClipProjectDto,
        uploadSrtDto,
        userId,
      );
    }
  }

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

  private isValidVideoFile(file: Express.Multer.File): boolean {
    const allowedMimeTypes = [
      'video/mp4',
      'video/quicktime', // .mov
      'video/x-msvideo', // .avi
      'video/x-matroska', // .mkv
      'video/x-ms-wmv', // .wmv
    ];
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.wmv'];
    const extension = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf('.'));

    return (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(extension)
    );
  }

  @Post(':id/srt/upload')
  @ApiOperation({
    summary: 'Upload SRT file using multipart form data',
    description:
      'Upload an SRT subtitle file for the clip project using file upload',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'SRT file upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'SRT subtitle file',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'SRT file uploaded and theme analysis started',
    type: ClipProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid SRT file format or content',
  })
  @ApiResponse({
    status: 404,
    description: 'Clip project not found',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSRTFile(
    @Param('id') clipId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(text\/plain|application\/x-subrip)/,
        })
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024, // 10MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: any,
  ): Promise<ClipProjectResponseDto> {
    this.logger.log(
      `Uploading SRT file for clip: ${clipId} by user: ${user.sub}`,
    );

    const uploadSrtDto: UploadSrtDto = {
      srtContent: file.buffer.toString('utf-8'),
      srtFileName: file.originalname,
    };

    return this.clipsService.uploadSRT(clipId, uploadSrtDto, user.sub);
  }

  @Post(':id/srt/content')
  @ApiOperation({
    summary: 'Upload SRT content as text',
    description:
      'Upload SRT subtitle content as plain text for the clip project',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'SRT content uploaded and theme analysis started',
    type: ClipProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid SRT content format',
  })
  @ApiResponse({
    status: 404,
    description: 'Clip project not found',
  })
  async uploadSRTContent(
    @Param('id') clipId: string,
    @Body() uploadSrtDto: UploadSrtDto,
    @CurrentUser() user: any,
  ): Promise<ClipProjectResponseDto> {
    this.logger.log(
      `Uploading SRT content for clip: ${clipId} by user: ${user.sub}`,
    );
    return this.clipsService.uploadSRT(clipId, uploadSrtDto, user.sub);
  }

  @Get(':id/themes')
  @ApiOperation({
    summary: 'Get theme analysis results',
    description: 'Get the analyzed themes from the uploaded SRT content',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Theme analysis results',
    type: ThemeAnalysisResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Theme analysis not ready or failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Clip project not found',
  })
  async getThemeAnalysis(
    @Param('id') clipId: string,
    @CurrentUser() user: any,
  ): Promise<ThemeAnalysisResponseDto> {
    this.logger.log(
      `Getting theme analysis for clip: ${clipId} by user: ${user.sub}`,
    );
    return this.clipsService.getThemeAnalysis(clipId, user.sub);
  }

  @Post(':id/generate')
  @ApiOperation({
    summary: 'Select theme and generate clips',
    description:
      'Select a theme from the analysis results and generate video clips',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Clips generated successfully',
    type: ClipGenerationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid theme selection or clip generation not ready',
  })
  @ApiResponse({
    status: 404,
    description: 'Clip project not found',
  })
  async selectThemeAndGenerate(
    @Param('id') clipId: string,
    @Body() selectThemeDto: SelectThemeAndGenerateDto,
    @CurrentUser() user: any,
  ): Promise<ClipGenerationResponseDto> {
    this.logger.log(
      `Generating clips for clip: ${clipId} with theme: ${selectThemeDto.selectedTheme.title} by user: ${user.sub}`,
    );
    return this.clipsService.selectThemeAndGenerate(
      clipId,
      selectThemeDto,
      user.sub,
    );
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
  async getClipProject(
    @Param('id') clipId: string,
    @CurrentUser() user: any,
  ): Promise<ClipProjectResponseDto> {
    this.logger.log(`Getting clip project: ${clipId} for user: ${user.sub}`);
    return this.clipsService.getClipProject(clipId, user.sub);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all clip projects',
    description: 'Get a paginated list of clip projects for the current user',
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
    description: 'Items per page (default: 10, max: 50)',
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
    enum: [
      'pending',
      'analyzing',
      'ready_for_generation',
      'generating',
      'completed',
      'failed',
    ],
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in title and description',
    example: 'AI healthcare',
  })
  @ApiResponse({
    status: 200,
    description: 'List of clip projects',
    type: ClipListResponseDto,
  })
  async getClipProjects(
    @Query() queryDto: ClipQueryDto,
    @CurrentUser() user: any,
  ): Promise<ClipListResponseDto> {
    this.logger.log(
      `Getting clip projects for user: ${user.sub} with query: ${JSON.stringify(queryDto)}`,
    );
    return this.clipsService.getClipProjects(user.sub, queryDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete clip project',
    description: 'Delete a clip project and all associated files',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Clip project deleted successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Clip project not found',
  })
  async deleteClipProject(
    @Param('id') clipId: string,
    @CurrentUser() user: any,
  ): Promise<MessageResponseDto> {
    this.logger.log(`Deleting clip project: ${clipId} for user: ${user.sub}`);
    await this.clipsService.deleteClipProject(clipId, user.sub);
    return { message: 'Clip project deleted successfully' };
  }

  @Get('stats/overview')
  @ApiOperation({
    summary: 'Get clip statistics',
    description: "Get overview statistics for the current user's clip projects",
  })
  @ApiResponse({
    status: 200,
    description: 'Clip statistics',
    schema: {
      type: 'object',
      properties: {
        totalProjects: { type: 'number', example: 25 },
        totalGeneratedClips: { type: 'number', example: 150 },
        statusBreakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string', example: 'completed' },
              count: { type: 'number', example: 15 },
              totalCost: { type: 'number', example: 2.45 },
              totalTokens: { type: 'number', example: 50000 },
              totalDuration: { type: 'number', example: 18000 },
            },
          },
        },
        totalEstimatedCost: { type: 'number', example: 4.76 },
        totalTokensUsed: { type: 'number', example: 125000 },
        totalProcessingTime: { type: 'number', example: 45000 },
      },
    },
  })
  async getClipStatistics(@CurrentUser() user: any): Promise<any> {
    this.logger.log(`Getting clip statistics for user: ${user.sub}`);
    return this.clipsService.getClipStatistics(user.sub);
  }

  @Post('upload/signed-url')
  @ApiOperation({
    summary: 'Generate signed URL for file upload',
    description:
      'Generate a pre-signed URL for uploading files directly to cloud storage',
  })
  @ApiResponse({
    status: 201,
    description: 'Signed URL generated successfully',
    type: SignedUrlUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file parameters or file size exceeds limits',
  })
  async generateSignedUrl(
    @Body() requestDto: UploadToSignedUrlRequestDto,
    @CurrentUser() user: any,
  ): Promise<SignedUrlUploadResponseDto> {
    // Handle public access (no authentication) with default test user
    const userId = user?.sub || 'test-user-id';

    this.logger.log(
      `Generating signed URL for file: ${requestDto.fileName} (${requestDto.fileSize} bytes) for user: ${userId}`,
    );

    // Generate unique file ID
    const fileId = this.fileUploadService.generateFileId(
      userId,
      requestDto.fileName,
    );

    // Generate signed URL
    const result = await this.fileUploadService.generateSignedUrl({
      fileId,
      fileName: requestDto.fileName,
      fileSize: requestDto.fileSize,
      mimeType: requestDto.mimeType,
      fileType: requestDto.fileType || 'other',
      userId,
      expiresIn: 3600, // 1 hour
      metadata: requestDto.metadata,
    });

    return result;
  }

  @Get('upload/status/:fileId')
  @ApiOperation({
    summary: 'Check upload status',
    description:
      'Check if a file has been successfully uploaded to the signed URL',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File identifier returned from signed URL generation',
    example: 'user123_1234567890_abc123_my_video.mp4',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload status information',
    type: UploadStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'File not found or upload not completed',
  })
  async getUploadStatus(
    @Param('fileId') fileId: string,
    @CurrentUser() user: any,
  ): Promise<UploadStatusDto> {
    // Handle public access (no authentication) with default test user
    const userId = user?.sub || 'test-user-id';

    this.logger.log(
      `Checking upload status for file: ${fileId} by user: ${userId}`,
    );

    // Generate S3 file URL - extract userId and fileType from the request
    const bucket = process.env.AWS_S3_BUCKET;
    const fileType = 'other'; // Default file type, could be extracted from fileId if needed
    const fileUrl = `https://${bucket}.s3.amazonaws.com/uploads/${userId}/${fileType}s/${fileId}`;

    // Verify upload completion
    const verification = await this.fileUploadService.verifyUploadCompletion(
      fileId,
      fileUrl,
    );

    if (!verification.exists) {
      throw new NotFoundException('File not found or upload not completed');
    }

    return {
      fileId,
      status: 'completed',
      fileUrl,
      fileSize: verification.fileSize || 0,
      uploadedAt: verification.lastModified || new Date(),
    };
  }

  @Post('upload/complete/:fileId')
  @ApiOperation({
    summary: 'Mark upload as complete',
    description:
      'Notify the system that a file upload has been completed (for tracking purposes)',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File identifier returned from signed URL generation',
    example: 'user123_1234567890_abc123_my_video.mp4',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload marked as complete',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  async markUploadComplete(
    @Param('fileId') fileId: string,
    @CurrentUser() user: any,
  ): Promise<MessageResponseDto> {
    // Handle public access (no authentication) with default test user
    const userId = user?.sub || 'test-user-id';

    this.logger.log(
      `Marking upload complete for file: ${fileId} by user: ${userId}`,
    );

    // This could be expanded to update a database record tracking upload status
    // For now, we'll just verify the file exists in S3
    const bucket = process.env.AWS_S3_BUCKET;
    const fileType = 'other'; // Default file type, could be extracted from fileId if needed
    const fileUrl = `https://${bucket}.s3.amazonaws.com/uploads/${userId}/${fileType}s/${fileId}`;

    const verification = await this.fileUploadService.verifyUploadCompletion(
      fileId,
      fileUrl,
    );

    if (!verification.exists) {
      throw new NotFoundException(
        'File not found - upload may not have completed successfully',
      );
    }

    return {
      message: `File ${fileId} upload marked as complete`,
    };
  }
}
