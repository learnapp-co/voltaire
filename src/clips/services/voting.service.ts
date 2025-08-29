import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Clip,
  ClipDocument,
  GeneratedClip,
  VoteDetail,
} from '../../schemas/clip.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { CollaboratorService } from './collaborator.service';
import {
  VoteForPostingDto,
  RateClipDto,
  VoteDetailResponseDto,
  PostingVotesResponseDto,
  RatingVotesResponseDto,
  ClipVotingSummaryDto,
  ProjectVotingSummaryDto,
  VoteSuccessResponseDto,
  RemoveVoteDto,
  VotingStatsDto,
} from '../dto/voting.dto';

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    @InjectModel(Clip.name) private clipModel: Model<ClipDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private collaboratorService: CollaboratorService,
  ) {}

  /**
   * Vote on whether a clip should be posted
   */
  async voteForPosting(
    clipId: string,
    clipDbId: string,
    voteDto: VoteForPostingDto,
    userId: string,
  ): Promise<VoteSuccessResponseDto> {
    try {
      // Verify user has access to the project
      await this.collaboratorService.verifyUserAccess(clipId, userId);

      const clip = await this.clipModel.findById(clipId);
      if (!clip) {
        throw new NotFoundException('Clip project not found');
      }

      // Find the generated clip
      const generatedClip = clip.generatedClips.find(
        (gc) => (gc as any)._id.toString() === clipDbId,
      );

      if (!generatedClip) {
        throw new NotFoundException('Generated clip not found');
      }

      // Initialize voting structure if not exists
      if (!generatedClip.voting) {
        generatedClip.voting = {
          shouldThisBePosted: { yes: [], no: [] },
          clipRating: {
            rating1: [],
            rating2: [],
            rating3: [],
            rating4: [],
            rating5: [],
          },
        };
      }

      // Remove any existing vote from this user
      const previousVote = this.removeUserPostingVote(generatedClip, userId);

      // Add new vote
      const voteDetail: VoteDetail = {
        userId: userId as any,
        votedAt: new Date(),
      };

      if (voteDto.vote === 'yes') {
        generatedClip.voting.shouldThisBePosted.yes.push(voteDetail);
      } else {
        generatedClip.voting.shouldThisBePosted.no.push(voteDetail);
      }

      await clip.save();

      this.logger.log(
        `User ${userId} voted "${voteDto.vote}" for posting clip ${clipDbId}`,
      );

      return {
        success: true,
        message: 'Vote recorded successfully',
        voteType: 'posting',
        previousVote,
        newVote: voteDto.vote,
      };
    } catch (error) {
      this.logger.error(`Error voting for posting clip ${clipDbId}:`, error);

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to record vote');
    }
  }

  /**
   * Rate a clip (1-5 stars)
   */
  async rateClip(
    clipId: string,
    clipDbId: string,
    rateDto: RateClipDto,
    userId: string,
  ): Promise<VoteSuccessResponseDto> {
    try {
      // Verify user has access to the project
      await this.collaboratorService.verifyUserAccess(clipId, userId);

      const clip = await this.clipModel.findById(clipId);
      if (!clip) {
        throw new NotFoundException('Clip project not found');
      }

      // Find the generated clip
      const generatedClip = clip.generatedClips.find(
        (gc) => (gc as any)._id.toString() === clipDbId,
      );

      if (!generatedClip) {
        throw new NotFoundException('Generated clip not found');
      }

      // Initialize voting structure if not exists
      if (!generatedClip.voting) {
        generatedClip.voting = {
          shouldThisBePosted: { yes: [], no: [] },
          clipRating: {
            rating1: [],
            rating2: [],
            rating3: [],
            rating4: [],
            rating5: [],
          },
        };
      }

      // Remove any existing rating from this user
      const previousRating = this.removeUserRating(generatedClip, userId);

      // Add new rating
      const voteDetail: VoteDetail = {
        userId: userId as any,
        votedAt: new Date(),
      };

      const ratingKey =
        `rating${rateDto.rating}` as keyof typeof generatedClip.voting.clipRating;
      generatedClip.voting.clipRating[ratingKey].push(voteDetail);

      await clip.save();

      this.logger.log(
        `User ${userId} rated clip ${clipDbId} with ${rateDto.rating} stars`,
      );

      return {
        success: true,
        message: 'Rating recorded successfully',
        voteType: 'rating',
        previousVote: previousRating?.toString(),
        newVote: rateDto.rating.toString(),
      };
    } catch (error) {
      this.logger.error(`Error rating clip ${clipDbId}:`, error);

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to record rating');
    }
  }

  /**
   * Get voting summary for a specific clip
   */
  async getClipVotingSummary(
    clipId: string,
    clipDbId: string,
    userId: string,
  ): Promise<ClipVotingSummaryDto> {
    try {
      // Verify user has access to the project
      await this.collaboratorService.verifyUserAccess(clipId, userId);

      const clip = await this.clipModel
        .findById(clipId)
        .populate('collaborators.userId', 'email firstName lastName')
        .populate('userId', 'email firstName lastName');

      if (!clip) {
        throw new NotFoundException('Clip project not found');
      }

      // Find the generated clip
      const generatedClip = clip.generatedClips.find(
        (gc) => (gc as any)._id.toString() === clipDbId,
      );

      if (!generatedClip) {
        throw new NotFoundException('Generated clip not found');
      }

      // Build voting summary
      const postingVotes = await this.buildPostingVotesResponse(generatedClip);
      const ratingVotes = await this.buildRatingVotesResponse(generatedClip);

      // Get current user's votes
      const currentUserPostingVote = this.getCurrentUserPostingVote(
        generatedClip,
        userId,
      );
      const currentUserRating = this.getCurrentUserRating(
        generatedClip,
        userId,
      );

      return {
        clipDbId,
        clipTitle: generatedClip.title,
        postingVotes,
        ratingVotes,
        currentUserPostingVote,
        currentUserRating,
      };
    } catch (error) {
      this.logger.error(
        `Error getting voting summary for clip ${clipDbId}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to get voting summary');
    }
  }

  /**
   * Get voting summary for entire project
   */
  async getProjectVotingSummary(
    clipId: string,
    userId: string,
  ): Promise<ProjectVotingSummaryDto> {
    try {
      // Verify user has access to the project
      await this.collaboratorService.verifyUserAccess(clipId, userId);

      const clip = await this.clipModel
        .findById(clipId)
        .populate('collaborators.userId', 'email firstName lastName')
        .populate('userId', 'email firstName lastName');

      if (!clip) {
        throw new NotFoundException('Clip project not found');
      }

      const clipSummaries: ClipVotingSummaryDto[] = [];
      let clipsWithVotes = 0;

      for (const generatedClip of clip.generatedClips) {
        const clipDbId = (generatedClip as any)._id.toString();

        const postingVotes =
          await this.buildPostingVotesResponse(generatedClip);
        const ratingVotes = await this.buildRatingVotesResponse(generatedClip);

        // Check if this clip has any votes
        const hasVotes =
          postingVotes.yesCount > 0 ||
          postingVotes.noCount > 0 ||
          ratingVotes.totalRatings > 0;

        if (hasVotes) {
          clipsWithVotes++;
        }

        const currentUserPostingVote = this.getCurrentUserPostingVote(
          generatedClip,
          userId,
        );
        const currentUserRating = this.getCurrentUserRating(
          generatedClip,
          userId,
        );

        clipSummaries.push({
          clipDbId,
          clipTitle: generatedClip.title,
          postingVotes,
          ratingVotes,
          currentUserPostingVote,
          currentUserRating,
        });
      }

      return {
        projectId: clipId,
        projectTitle: clip.title,
        clips: clipSummaries,
        totalClips: clip.generatedClips.length,
        clipsWithVotes,
      };
    } catch (error) {
      this.logger.error(
        `Error getting project voting summary for ${clipId}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to get project voting summary',
      );
    }
  }

  /**
   * Remove a user's vote
   */
  async removeVote(
    clipId: string,
    clipDbId: string,
    removeDto: RemoveVoteDto,
    userId: string,
  ): Promise<VoteSuccessResponseDto> {
    try {
      // Verify user has access to the project
      await this.collaboratorService.verifyUserAccess(clipId, userId);

      const clip = await this.clipModel.findById(clipId);
      if (!clip) {
        throw new NotFoundException('Clip project not found');
      }

      // Find the generated clip
      const generatedClip = clip.generatedClips.find(
        (gc) => (gc as any)._id.toString() === clipDbId,
      );

      if (!generatedClip) {
        throw new NotFoundException('Generated clip not found');
      }

      let removedVote: string | undefined;

      if (removeDto.voteType === 'posting') {
        removedVote = this.removeUserPostingVote(generatedClip, userId);
      } else if (removeDto.voteType === 'rating') {
        const rating = this.removeUserRating(generatedClip, userId);
        removedVote = rating?.toString();
      }

      if (!removedVote) {
        throw new BadRequestException('No vote found to remove');
      }

      await clip.save();

      this.logger.log(
        `User ${userId} removed ${removeDto.voteType} vote for clip ${clipDbId}`,
      );

      return {
        success: true,
        message: 'Vote removed successfully',
        voteType: removeDto.voteType,
        previousVote: removedVote,
        newVote: 'none',
      };
    } catch (error) {
      this.logger.error(`Error removing vote for clip ${clipDbId}:`, error);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to remove vote');
    }
  }

  /**
   * Get voting statistics for a project
   */
  async getVotingStats(
    clipId: string,
    userId: string,
  ): Promise<VotingStatsDto> {
    try {
      // Verify user has access to the project
      await this.collaboratorService.verifyUserAccess(clipId, userId);

      const clip = await this.clipModel.findById(clipId);
      if (!clip) {
        throw new NotFoundException('Clip project not found');
      }

      // Count total potential voters (owner + collaborators)
      const totalVoters = 1 + clip.collaborators.length;

      let postingVoterCount = 0;
      let ratingVoterCount = 0;

      // Count unique voters across all clips
      const postingVoters = new Set<string>();
      const ratingVoters = new Set<string>();

      for (const generatedClip of clip.generatedClips) {
        if (generatedClip.voting) {
          // Count posting voters
          generatedClip.voting.shouldThisBePosted.yes.forEach((vote) =>
            postingVoters.add(vote.userId.toString()),
          );
          generatedClip.voting.shouldThisBePosted.no.forEach((vote) =>
            postingVoters.add(vote.userId.toString()),
          );

          // Count rating voters
          Object.values(generatedClip.voting.clipRating).forEach(
            (ratingArray) =>
              ratingArray.forEach((vote) =>
                ratingVoters.add(vote.userId.toString()),
              ),
          );
        }
      }

      postingVoterCount = postingVoters.size;
      ratingVoterCount = ratingVoters.size;

      return {
        totalVoters,
        postingVoterCount,
        ratingVoterCount,
        postingParticipationRate:
          totalVoters > 0 ? (postingVoterCount / totalVoters) * 100 : 0,
        ratingParticipationRate:
          totalVoters > 0 ? (ratingVoterCount / totalVoters) * 100 : 0,
      };
    } catch (error) {
      this.logger.error(
        `Error getting voting stats for project ${clipId}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to get voting statistics');
    }
  }

  /**
   * Helper methods
   */
  private async buildPostingVotesResponse(
    generatedClip: GeneratedClip,
  ): Promise<PostingVotesResponseDto> {
    const voting = generatedClip.voting;

    if (!voting) {
      return {
        yesCount: 0,
        noCount: 0,
        yesVotes: [],
        noVotes: [],
      };
    }

    const yesVotes = await this.populateVoteDetails(
      voting.shouldThisBePosted.yes,
    );
    const noVotes = await this.populateVoteDetails(
      voting.shouldThisBePosted.no,
    );

    return {
      yesCount: yesVotes.length,
      noCount: noVotes.length,
      yesVotes,
      noVotes,
    };
  }

  private async buildRatingVotesResponse(
    generatedClip: GeneratedClip,
  ): Promise<RatingVotesResponseDto> {
    const voting = generatedClip.voting;

    if (!voting) {
      return {
        rating1Count: 0,
        rating2Count: 0,
        rating3Count: 0,
        rating4Count: 0,
        rating5Count: 0,
        averageRating: 0,
        totalRatings: 0,
        rating1Votes: [],
        rating2Votes: [],
        rating3Votes: [],
        rating4Votes: [],
        rating5Votes: [],
      };
    }

    const rating1Votes = await this.populateVoteDetails(
      voting.clipRating.rating1,
    );
    const rating2Votes = await this.populateVoteDetails(
      voting.clipRating.rating2,
    );
    const rating3Votes = await this.populateVoteDetails(
      voting.clipRating.rating3,
    );
    const rating4Votes = await this.populateVoteDetails(
      voting.clipRating.rating4,
    );
    const rating5Votes = await this.populateVoteDetails(
      voting.clipRating.rating5,
    );

    const totalRatings =
      rating1Votes.length +
      rating2Votes.length +
      rating3Votes.length +
      rating4Votes.length +
      rating5Votes.length;

    const weightedSum =
      1 * rating1Votes.length +
      2 * rating2Votes.length +
      3 * rating3Votes.length +
      4 * rating4Votes.length +
      5 * rating5Votes.length;

    const averageRating =
      totalRatings > 0
        ? parseFloat((weightedSum / totalRatings).toFixed(2))
        : 0;

    return {
      rating1Count: rating1Votes.length,
      rating2Count: rating2Votes.length,
      rating3Count: rating3Votes.length,
      rating4Count: rating4Votes.length,
      rating5Count: rating5Votes.length,
      averageRating,
      totalRatings,
      rating1Votes,
      rating2Votes,
      rating3Votes,
      rating4Votes,
      rating5Votes,
    };
  }

  private async populateVoteDetails(
    votes: VoteDetail[],
  ): Promise<VoteDetailResponseDto[]> {
    const userIds = votes.map((vote) => vote.userId);
    const users = await this.userModel.find({ _id: { $in: userIds } });

    const userMap = new Map();
    users.forEach((user) => {
      userMap.set(user._id.toString(), user);
    });

    return votes.map((vote) => {
      const user = userMap.get(vote.userId.toString());
      return {
        user: {
          userId: vote.userId.toString(),
          email: user?.email || 'Unknown',
          firstName: user?.firstName || 'Unknown',
          lastName: user?.lastName || 'User',
        },
        votedAt: vote.votedAt,
      };
    });
  }

  private removeUserPostingVote(
    generatedClip: GeneratedClip,
    userId: string,
  ): string | undefined {
    if (!generatedClip.voting) return undefined;

    // Check yes votes
    const yesIndex = generatedClip.voting.shouldThisBePosted.yes.findIndex(
      (vote) => vote.userId.toString() === userId,
    );
    if (yesIndex !== -1) {
      generatedClip.voting.shouldThisBePosted.yes.splice(yesIndex, 1);
      return 'yes';
    }

    // Check no votes
    const noIndex = generatedClip.voting.shouldThisBePosted.no.findIndex(
      (vote) => vote.userId.toString() === userId,
    );
    if (noIndex !== -1) {
      generatedClip.voting.shouldThisBePosted.no.splice(noIndex, 1);
      return 'no';
    }

    return undefined;
  }

  private removeUserRating(
    generatedClip: GeneratedClip,
    userId: string,
  ): number | undefined {
    if (!generatedClip.voting) return undefined;

    const ratings = [
      'rating1',
      'rating2',
      'rating3',
      'rating4',
      'rating5',
    ] as const;

    for (let i = 0; i < ratings.length; i++) {
      const ratingKey = ratings[i];
      const ratingArray = generatedClip.voting.clipRating[ratingKey];
      const voteIndex = ratingArray.findIndex(
        (vote) => vote.userId.toString() === userId,
      );

      if (voteIndex !== -1) {
        ratingArray.splice(voteIndex, 1);
        return i + 1; // Return rating value (1-5)
      }
    }

    return undefined;
  }

  private getCurrentUserPostingVote(
    generatedClip: GeneratedClip,
    userId: string,
  ): 'yes' | 'no' | undefined {
    if (!generatedClip.voting) return undefined;

    const hasYesVote = generatedClip.voting.shouldThisBePosted.yes.some(
      (vote) => vote.userId.toString() === userId,
    );
    if (hasYesVote) return 'yes';

    const hasNoVote = generatedClip.voting.shouldThisBePosted.no.some(
      (vote) => vote.userId.toString() === userId,
    );
    if (hasNoVote) return 'no';

    return undefined;
  }

  private getCurrentUserRating(
    generatedClip: GeneratedClip,
    userId: string,
  ): number | undefined {
    if (!generatedClip.voting) return undefined;

    const ratings = [
      'rating1',
      'rating2',
      'rating3',
      'rating4',
      'rating5',
    ] as const;

    for (let i = 0; i < ratings.length; i++) {
      const ratingKey = ratings[i];
      const hasVote = generatedClip.voting.clipRating[ratingKey].some(
        (vote) => vote.userId.toString() === userId,
      );

      if (hasVote) {
        return i + 1; // Return rating value (1-5)
      }
    }

    return undefined;
  }
}
