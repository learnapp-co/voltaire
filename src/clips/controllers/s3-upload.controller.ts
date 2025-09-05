import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserDocument } from '../../schemas/user.schema';
import { S3UploadService } from '../services/s3-upload.service';
import {
  SignedUrlRequestDto,
  SignedUrlResponseDto,
  InitiateMultipartUploadDto,
  InitiateMultipartUploadResponseDto,
  ChunkUploadUrlRequestDto,
  ChunkUploadUrlResponseDto,
  CompleteMultipartUploadDto,
  CompleteMultipartUploadResponseDto,
} from '../dto/clips.dto';

@ApiTags('s3-upload')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('clips/upload')
export class S3UploadController {
  private readonly logger = new Logger(S3UploadController.name);

  constructor(private readonly s3UploadService: S3UploadService) {}

  @Post('signed-url')
  @ApiOperation({
    summary: 'Generate signed URL for S3 upload (single upload)',
    description:
      'Generate a pre-signed URL for uploading small video files directly to S3',
  })
  @ApiResponse({
    status: 200,
    description: 'Signed URL generated successfully',
    type: SignedUrlResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async generateSignedUrl(
    @CurrentUser() user: UserDocument,
    @Body() request: SignedUrlRequestDto,
  ): Promise<SignedUrlResponseDto> {
    this.logger.log(
      `User ${user.email} generating signed URL for file: ${request.fileName} (${request.fileSize} bytes)`,
    );

    return this.s3UploadService.generateSignedUrl(request);
  }

  @Post('multipart/initiate')
  @ApiOperation({
    summary: 'Initiate multipart upload',
    description: 'Start a multipart upload session for large video files',
  })
  @ApiResponse({
    status: 200,
    description: 'Multipart upload initiated successfully',
    type: InitiateMultipartUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async initiateMultipartUpload(
    @CurrentUser() user: UserDocument,
    @Body() request: InitiateMultipartUploadDto,
  ): Promise<InitiateMultipartUploadResponseDto> {
    this.logger.log(
      `User ${user.email} initiating multipart upload for file: ${request.fileName} (${request.fileSize} bytes)`,
    );

    return this.s3UploadService.initiateMultipartUpload(request);
  }

  @Post('multipart/chunk-url')
  @ApiOperation({
    summary: 'Get signed URL for chunk upload',
    description:
      'Generate a pre-signed URL for uploading a specific chunk/part',
  })
  @ApiResponse({
    status: 200,
    description: 'Chunk upload URL generated successfully',
    type: ChunkUploadUrlResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid upload ID or part number',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getChunkUploadUrl(
    @CurrentUser() user: UserDocument,
    @Body() request: ChunkUploadUrlRequestDto,
  ): Promise<ChunkUploadUrlResponseDto> {
    this.logger.log(
      `User ${user.email} generating chunk upload URL for upload ${request.uploadId}, part ${request.partNumber}`,
    );

    return this.s3UploadService.generateChunkUploadUrl(request);
  }

  @Post('multipart/complete')
  @ApiOperation({
    summary: 'Complete multipart upload',
    description:
      'Complete the multipart upload by combining all uploaded parts',
  })
  @ApiResponse({
    status: 200,
    description: 'Multipart upload completed successfully',
    type: CompleteMultipartUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid upload ID or missing parts',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async completeMultipartUpload(
    @CurrentUser() user: UserDocument,
    @Body() request: CompleteMultipartUploadDto,
  ): Promise<CompleteMultipartUploadResponseDto> {
    this.logger.log(
      `User ${user.email} completing multipart upload ${request.uploadId} with ${request.parts.length} parts`,
    );

    return this.s3UploadService.completeMultipartUpload(request);
  }

  @Post('multipart/abort/:uploadId/:fileKey')
  @ApiOperation({
    summary: 'Abort multipart upload',
    description: 'Cancel and cleanup a multipart upload session',
  })
  @ApiParam({
    name: 'uploadId',
    description: 'The upload ID to abort',
  })
  @ApiParam({
    name: 'fileKey',
    description: 'The S3 file key',
  })
  @ApiResponse({
    status: 200,
    description: 'Multipart upload aborted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid upload ID',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async abortMultipartUpload(
    @CurrentUser() user: UserDocument,
    @Param('uploadId') uploadId: string,
    @Param('fileKey') fileKey: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `User ${user.email} aborting multipart upload ${uploadId} for file ${fileKey}`,
    );

    await this.s3UploadService.abortMultipartUpload(uploadId, fileKey);

    return { message: 'Multipart upload aborted successfully' };
  }
}
