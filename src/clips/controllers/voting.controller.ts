import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
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
import { VotingService } from '../services/voting.service';
import {
  VoteForPostingDto,
  RateClipDto,
  ClipVotingSummaryDto,
  ProjectVotingSummaryDto,
  VoteSuccessResponseDto,
  RemoveVoteDto,
  VotingStatsDto,
} from '../dto/voting.dto';

@ApiTags('voting')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('clips/:id')
export class VotingController {
  private readonly logger = new Logger(VotingController.name);

  constructor(private readonly votingService: VotingService) {}

  @Post('clips/:clipDbId/vote/posting')
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

  @Post('clips/:clipDbId/vote/rating')
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

  @Get('clips/:clipDbId/voting')
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

  @Get('voting')
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

  @Delete('clips/:clipDbId/vote')
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

  @Get('voting/stats')
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
}
