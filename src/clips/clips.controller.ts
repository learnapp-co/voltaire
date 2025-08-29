import {
  Controller,
  Delete,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../schemas/user.schema';
import { ClipsService } from './clips.service';
import { S3UploadService } from './services/s3-upload.service';
import { CollaboratorService } from './services/collaborator.service';
import { VotingService } from './services/voting.service';
import {
  CreateClipProjectWithSrtDto,
  ClipProjectResponseDto,
  ClipListResponseDto,
  ClipQueryDto,
  UpdateClipProjectDto,
  GenerateClipsDto,
  ClipGenerationResponseDto,
  RegenerateClipDto,
  GeneratedClipDto,
  SignedUrlRequestDto,
  SignedUrlResponseDto,
  InitiateMultipartUploadDto,
  InitiateMultipartUploadResponseDto,
  ChunkUploadUrlRequestDto,
  ChunkUploadUrlResponseDto,
  CompleteMultipartUploadDto,
  CompleteMultipartUploadResponseDto,
} from './dto/clips.dto';
import {
  InviteCollaboratorDto,
  BulkInviteCollaboratorsDto,
  ListCollaboratorsResponseDto,
  ListInvitationsResponseDto,
  RemoveCollaboratorDto,
  InvitationSuccessResponseDto,
  BulkInvitationResponseDto,
} from './dto/collaborator.dto';
import {
  VoteForPostingDto,
  RateClipDto,
  ClipVotingSummaryDto,
  ProjectVotingSummaryDto,
  VoteSuccessResponseDto,
  RemoveVoteDto,
  VotingStatsDto,
} from './dto/voting.dto';

@ApiTags('clips')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('clips')
export class ClipsController {
  private readonly logger = new Logger(ClipsController.name);

  constructor(
    private readonly clipsService: ClipsService,
    private readonly s3UploadService: S3UploadService,
    private readonly collaboratorService: CollaboratorService,
    private readonly votingService: VotingService,
  ) {}

  @Post('upload/signed-url')
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

  @Post('upload/multipart/initiate')
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

  @Post('upload/multipart/chunk-url')
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

  @Post('upload/multipart/complete')
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

  @Post('upload/multipart/abort/:uploadId/:fileKey')
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
    description: 'Get all clip projects',
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

  @Post(':id/generate')
  @ApiOperation({
    summary: 'Generate clips from timestamps',
    description: 'Generate video clips based on user-provided timestamps',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiBody({
    description: 'Clip generation parameters with timestamps',
    type: GenerateClipsDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Clips generated successfully',
    type: ClipGenerationResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async generateClips(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Body() generateDto: GenerateClipsDto,
  ): Promise<ClipGenerationResponseDto> {
    this.logger.log(
      `🎬 User ${user.email} generating ${generateDto.timestamps.length} clips for project ${clipId}`,
    );
    this.logger.log(
      `📋 Clip parameters - Quality: ${generateDto.quality || 'medium'}, Format: ${generateDto.format || 'mp4'}`,
    );

    const result = await this.clipsService.generateClips(
      clipId,
      generateDto,
      user._id.toString(),
    );

    this.logger.log(
      `✅ Clip generation completed for project ${clipId} - Generated: ${result.generatedClips.length} clips`,
    );
    return result;
  }

  @Post(':id/regenerate-clip')
  @ApiOperation({
    summary: 'Regenerate a specific clip with modifications',
    description:
      'Regenerate a single clip by database ID with updated parameters',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiBody({
    description: 'Clip regeneration parameters',
    type: RegenerateClipDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Clip regenerated successfully',
    type: GeneratedClipDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid database ID or clip not found',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async regenerateClip(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Body() regenerateDto: RegenerateClipDto,
  ): Promise<GeneratedClipDto> {
    this.logger.log(
      `🔄 User ${user.email} regenerating clip ${regenerateDto.dbId} for project ${clipId}`,
    );
    this.logger.log(
      `📋 Regeneration params - Start: ${regenerateDto.startTime}s, End: ${regenerateDto.endTime}s, Title: ${regenerateDto.title}`,
    );

    const result = await this.clipsService.regenerateClip(
      clipId,
      regenerateDto,
      user._id.toString(),
    );

    this.logger.log(`✅ Clip regeneration completed for ${regenerateDto.dbId}`);
    return result;
  }

  // =============================================================================
  // COLLABORATOR MANAGEMENT ENDPOINTS
  // =============================================================================

  @Post(':id/collaborators/invite')
  @ApiOperation({
    summary: 'Invite a collaborator to the project',
    description:
      'Send an email invitation to a user to collaborate on this clip project',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiBody({
    description: 'Invitation details',
    type: InviteCollaboratorDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation sent successfully',
    type: InvitationSuccessResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email or invitation already exists',
  })
  @ApiResponse({
    status: 403,
    description: 'Only project owner can send invitations',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async inviteCollaborator(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Body() inviteDto: InviteCollaboratorDto,
  ): Promise<InvitationSuccessResponseDto> {
    this.logger.log(
      `User ${user.email} inviting ${inviteDto.email} to project ${clipId}`,
    );

    return this.collaboratorService.inviteCollaborator(
      clipId,
      inviteDto,
      user._id.toString(),
    );
  }

  @Post(':id/collaborators/bulk-invite')
  @ApiOperation({
    summary: 'Invite multiple collaborators to the project',
    description:
      'Send email invitations to multiple users to collaborate on this clip project',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiBody({
    description: 'Bulk invitation details',
    type: BulkInviteCollaboratorsDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk invitations processed',
    type: BulkInvitationResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only project owner can send invitations',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async bulkInviteCollaborators(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Body() bulkInviteDto: BulkInviteCollaboratorsDto,
  ): Promise<BulkInvitationResponseDto> {
    this.logger.log(
      `User ${user.email} bulk inviting ${bulkInviteDto.emails.length} users to project ${clipId}`,
    );

    return this.collaboratorService.bulkInviteCollaborators(
      clipId,
      bulkInviteDto,
      user._id.toString(),
    );
  }

  @Get(':id/collaborators')
  @ApiOperation({
    summary: 'Get all collaborators for the project',
    description: 'Get list of all collaborators and project owner',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiResponse({
    status: 200,
    description: 'List of collaborators',
    type: ListCollaboratorsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getCollaborators(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
  ): Promise<ListCollaboratorsResponseDto> {
    this.logger.log(
      `User ${user.email} getting collaborators for project ${clipId}`,
    );

    return this.collaboratorService.getCollaborators(
      clipId,
      user._id.toString(),
    );
  }

  @Get(':id/invitations')
  @ApiOperation({
    summary: 'Get all invitations for the project',
    description:
      'Get list of all pending and completed invitations (owner only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invitations',
    type: ListInvitationsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only project owner can view invitations',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getInvitations(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
  ): Promise<ListInvitationsResponseDto> {
    this.logger.log(
      `User ${user.email} getting invitations for project ${clipId}`,
    );

    return this.collaboratorService.getInvitations(clipId, user._id.toString());
  }

  @Delete(':id/collaborators')
  @ApiOperation({
    summary: 'Remove a collaborator from the project',
    description: 'Remove a collaborator from the project (owner only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiBody({
    description: 'Collaborator to remove',
    type: RemoveCollaboratorDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Collaborator removed successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only project owner can remove collaborators',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async removeCollaborator(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Body() removeDto: RemoveCollaboratorDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `User ${user.email} removing collaborator ${removeDto.userId} from project ${clipId}`,
    );

    return this.collaboratorService.removeCollaborator(
      clipId,
      removeDto,
      user._id.toString(),
    );
  }

  // =============================================================================
  // VOTING ENDPOINTS
  // =============================================================================

  @Post(':id/clips/:clipDbId/vote/posting')
  @ApiOperation({
    summary: 'Vote on whether a clip should be posted',
    description: 'Cast a vote on whether this generated clip should be posted',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'clipDbId',
    description: 'Generated clip database ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiBody({
    description: 'Posting vote',
    type: VoteForPostingDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Vote recorded successfully',
    type: VoteSuccessResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async voteForPosting(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Param('clipDbId') clipDbId: string,
    @Body() voteDto: VoteForPostingDto,
  ): Promise<VoteSuccessResponseDto> {
    this.logger.log(
      `User ${user.email} voting "${voteDto.vote}" for posting clip ${clipDbId}`,
    );

    return this.votingService.voteForPosting(
      clipId,
      clipDbId,
      voteDto,
      user._id.toString(),
    );
  }

  @Post(':id/clips/:clipDbId/vote/rating')
  @ApiOperation({
    summary: 'Rate a clip (1-5 stars)',
    description: 'Give a rating to this generated clip',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'clipDbId',
    description: 'Generated clip database ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiBody({
    description: 'Clip rating',
    type: RateClipDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Rating recorded successfully',
    type: VoteSuccessResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async rateClip(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Param('clipDbId') clipDbId: string,
    @Body() rateDto: RateClipDto,
  ): Promise<VoteSuccessResponseDto> {
    this.logger.log(
      `User ${user.email} rating clip ${clipDbId} with ${rateDto.rating} stars`,
    );

    return this.votingService.rateClip(
      clipId,
      clipDbId,
      rateDto,
      user._id.toString(),
    );
  }

  @Get(':id/clips/:clipDbId/voting')
  @ApiOperation({
    summary: 'Get voting summary for a specific clip',
    description: 'Get detailed voting information for a generated clip',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'clipDbId',
    description: 'Generated clip database ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiResponse({
    status: 200,
    description: 'Voting summary for the clip',
    type: ClipVotingSummaryDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getClipVoting(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Param('clipDbId') clipDbId: string,
  ): Promise<ClipVotingSummaryDto> {
    this.logger.log(
      `User ${user.email} getting voting summary for clip ${clipDbId}`,
    );

    return this.votingService.getClipVotingSummary(
      clipId,
      clipDbId,
      user._id.toString(),
    );
  }

  @Get(':id/voting')
  @ApiOperation({
    summary: 'Get voting summary for entire project',
    description:
      'Get voting information for all generated clips in the project',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiResponse({
    status: 200,
    description: 'Voting summary for the project',
    type: ProjectVotingSummaryDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getProjectVoting(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
  ): Promise<ProjectVotingSummaryDto> {
    this.logger.log(
      `User ${user.email} getting project voting summary for ${clipId}`,
    );

    return this.votingService.getProjectVotingSummary(
      clipId,
      user._id.toString(),
    );
  }

  @Delete(':id/clips/:clipDbId/vote')
  @ApiOperation({
    summary: 'Remove a vote',
    description: 'Remove your vote (posting or rating) from a clip',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiParam({
    name: 'clipDbId',
    description: 'Generated clip database ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiBody({
    description: 'Vote removal details',
    type: RemoveVoteDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Vote removed successfully',
    type: VoteSuccessResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async removeVote(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
    @Param('clipDbId') clipDbId: string,
    @Body() removeDto: RemoveVoteDto,
  ): Promise<VoteSuccessResponseDto> {
    this.logger.log(
      `User ${user.email} removing ${removeDto.voteType} vote for clip ${clipDbId}`,
    );

    return this.votingService.removeVote(
      clipId,
      clipDbId,
      removeDto,
      user._id.toString(),
    );
  }

  @Get(':id/voting/stats')
  @ApiOperation({
    summary: 'Get voting statistics for the project',
    description: 'Get participation statistics for voting in the project',
  })
  @ApiParam({
    name: 'id',
    description: 'Clip project ID',
    example: '60d5ecb74f3b2c001f5e4e8a',
  })
  @ApiResponse({
    status: 200,
    description: 'Voting statistics',
    type: VotingStatsDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getVotingStats(
    @CurrentUser() user: UserDocument,
    @Param('id') clipId: string,
  ): Promise<VotingStatsDto> {
    this.logger.log(
      `User ${user.email} getting voting stats for project ${clipId}`,
    );

    return this.votingService.getVotingStats(clipId, user._id.toString());
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
}
