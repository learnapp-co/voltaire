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
import { UploadSessionService } from './services/upload-session.service';
import { ConfigService } from '@nestjs/config';
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
  UpdateChunkStatusDto,
  CompleteChunkedUploadDto,
  AbortChunkedUploadDto,
  UploadProgressResponseDto,
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
    private readonly uploadSessionService: UploadSessionService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Create a new clip project with SRT file',
    description:
      'Create a new clip project with project name, video source (Google Drive URL OR AWS S3 file from chunked upload), and SRT subtitle file. Theme analysis will start automatically.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Project details and files. Provide either rawFileUrl OR localVideoFile OR awsFileUrl, not multiple.',
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

    // Validate that only one video source is provided
    const hasGoogleDriveUrl =
      body.rawFileUrl && body.rawFileUrl.trim().length > 0;
    const hasAwsFile = body.awsFileUrl && body.awsFileUrl.trim().length > 0;

    // Count video sources
    const videoSourceCount = [hasGoogleDriveUrl, hasAwsFile].filter(
      Boolean,
    ).length;

    if (videoSourceCount === 0) {
      throw new BadRequestException(
        'Must provide one video source: rawFileUrl (Google Drive) OR awsFileUrl (AWS S3)',
      );
    }

    if (videoSourceCount > 1) {
      throw new BadRequestException(
        'Provide only one video source: rawFileUrl OR awsFileUrl',
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

    if (hasAwsFile) {
      // Handle AWS S3 file from chunked upload
      return this.clipsService.createClipProjectWithAwsFile(
        body.title,
        body.awsFileUrl!,
        uploadSrtDto,
        body.selectedModel,
        userId,
        body.uploadSessionId,
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
    summary:
      'Generate signed URL for file upload (supports both single and chunked uploads)',
    description:
      'Generate a pre-signed URL for uploading files directly to cloud storage. Automatically uses chunked upload for large files or when explicitly requested.',
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
      `Generating signed URL for file: ${requestDto.fileName} (${requestDto.fileSize} bytes) for user: ${userId}. Chunked upload: ${requestDto.enableChunkedUpload || 'auto'}`,
    );

    // Generate unique file ID
    const fileId = this.fileUploadService.generateFileId(
      userId,
      requestDto.fileName,
    );

    // Generate signed URL with chunked upload support
    const result = await this.fileUploadService.generateSignedUrl(
      {
        fileId,
        fileName: requestDto.fileName,
        fileSize: requestDto.fileSize,
        mimeType: requestDto.mimeType,
        fileType: requestDto.fileType || 'other',
        userId,
        expiresIn: 3600, // 1 hour
        metadata: requestDto.metadata,
      },
      requestDto.enableChunkedUpload,
      requestDto.chunkSize,
    );

    // If it's a chunked upload, create upload session
    if (result.isChunkedUpload && result.sessionId && result.uploadId) {
      const bucket = this.configService.get<string>('AWS_S3_BUCKET');
      const key = `uploads/${userId}/${requestDto.fileType || 'other'}s/${fileId}`;

      // Create upload session and get the created session
      const uploadSession = await this.uploadSessionService.createUploadSession({
        userId,
        fileName: requestDto.fileName,
        fileSize: requestDto.fileSize,
        mimeType: requestDto.mimeType,
        fileType: requestDto.fileType || 'other',
        totalChunks: result.totalChunks!,
        chunkSize: result.chunkSize!,
        uploadId: result.uploadId,
        bucket: bucket!,
        key,
        metadata: requestDto.metadata,
        expiresIn: 3600,
      });

      // Update session status to uploading using the created session's ID
      await this.uploadSessionService.updateSessionStatus(
        uploadSession.sessionId,
        'uploading' as any,
      );

      // Replace the sessionId in the result with the actual one from the database
      result.sessionId = uploadSession.sessionId;
    }

    return result;
  }

  @Post('upload/chunk/status')
  @ApiOperation({
    summary: 'Update chunk upload status',
    description:
      'Update the status of an uploaded chunk in a chunked upload session',
  })
  @ApiResponse({
    status: 200,
    description: 'Chunk status updated successfully',
    type: UploadProgressResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid chunk data or session not found',
  })
  async updateChunkStatus(
    @Body() updateDto: UpdateChunkStatusDto,
    @CurrentUser() user: any,
  ): Promise<UploadProgressResponseDto> {
    const userId = user?.sub || 'test-user-id';

    this.logger.log(
      `Updating chunk ${updateDto.chunkNumber} status for session: ${updateDto.sessionId} by user: ${userId}`,
    );

    // Update chunk status
    await this.uploadSessionService.updateChunkStatus(
      updateDto.sessionId,
      updateDto.chunkNumber,
      updateDto.eTag,
      updateDto.size,
    );

    // Return current progress
    return this.uploadSessionService.getUploadProgress(updateDto.sessionId);
  }

  @Post('upload/chunk/complete')
  @ApiOperation({
    summary: 'Complete chunked upload',
    description: 'Complete a chunked upload session by combining all chunks',
  })
  @ApiResponse({
    status: 200,
    description: 'Chunked upload completed successfully',
    type: UploadProgressResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Upload session not ready for completion or invalid',
  })
  async completeChunkedUpload(
    @Body() completeDto: CompleteChunkedUploadDto,
    @CurrentUser() user: any,
  ): Promise<UploadProgressResponseDto> {
    const userId = user?.sub || 'test-user-id';

    this.logger.log(
      `Completing chunked upload for session: ${completeDto.sessionId} by user: ${userId}`,
    );

    // Get upload session
    const session = await this.uploadSessionService.getUploadSession(
      completeDto.sessionId,
    );

    // Validate all chunks are uploaded
    if (!this.uploadSessionService.validateAllChunksUploaded(session)) {
      throw new BadRequestException('Not all chunks have been uploaded');
    }

    // Get completed parts for S3
    const parts = this.uploadSessionService.getCompletedChunkParts(session);

    // Complete S3 multipart upload
    const finalFileUrl = await this.fileUploadService.completeMultipartUpload(
      session.bucket,
      session.key,
      session.uploadId,
      parts,
    );

    // Update session as completed
    await this.uploadSessionService.completeUploadSession(
      completeDto.sessionId,
      finalFileUrl,
    );

    this.logger.log(`Chunked upload completed: ${finalFileUrl}`);

    // Return final progress
    return this.uploadSessionService.getUploadProgress(completeDto.sessionId);
  }

  @Delete('upload/chunk/:sessionId')
  @ApiOperation({
    summary: 'Abort chunked upload',
    description: 'Abort a chunked upload session and clean up resources',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Upload session ID',
    example: 'session_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Chunked upload aborted successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Upload session not found',
  })
  async abortChunkedUpload(
    @Param('sessionId') sessionId: string,
    @Body() abortDto: AbortChunkedUploadDto,
    @CurrentUser() user: any,
  ): Promise<MessageResponseDto> {
    const userId = user?.sub || 'test-user-id';

    this.logger.log(
      `Aborting chunked upload for session: ${sessionId} by user: ${userId}. Reason: ${abortDto.reason || 'User requested'}`,
    );

    // Get upload session
    const session = await this.uploadSessionService.getUploadSession(sessionId);

    // Abort S3 multipart upload
    try {
      await this.fileUploadService.abortMultipartUpload(
        session.bucket,
        session.key,
        session.uploadId,
      );
    } catch (error) {
      this.logger.warn(`Failed to abort S3 multipart upload: ${error.message}`);
      // Continue with session cleanup even if S3 abort fails
    }

    // Update session as aborted
    await this.uploadSessionService.abortUploadSession(
      sessionId,
      abortDto.reason,
    );

    return { message: 'Chunked upload aborted successfully' };
  }

  @Get('upload/progress/:sessionId')
  @ApiOperation({
    summary: 'Get upload progress',
    description: 'Get the current progress of a chunked upload session',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Upload session ID',
    example: 'session_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload progress information',
    type: UploadProgressResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Upload session not found',
  })
  async getUploadProgress(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
  ): Promise<UploadProgressResponseDto> {
    const userId = user?.sub || 'test-user-id';

    this.logger.log(
      `Getting upload progress for session: ${sessionId} by user: ${userId}`,
    );

    return this.uploadSessionService.getUploadProgress(sessionId);
  }
}
