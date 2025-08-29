import { IsEnum, Min, Max, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Vote for posting DTO
export class VoteForPostingDto {
  @ApiProperty({
    description: 'Vote for whether this clip should be posted',
    enum: ['yes', 'no'],
    example: 'yes',
  })
  @IsEnum(['yes', 'no'])
  vote: 'yes' | 'no';
}

// Rate clip DTO
export class RateClipDto {
  @ApiProperty({
    description: 'Rating for the clip (1-5)',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;
}

// Vote detail response DTO
export class VoteDetailResponseDto {
  @ApiProperty({
    description: 'User who voted',
    example: {
      userId: '507f1f77bcf86cd799439011',
      email: 'voter@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
  })
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };

  @ApiProperty({
    description: 'When the vote was cast',
  })
  votedAt: Date;
}

// Posting votes response DTO
export class PostingVotesResponseDto {
  @ApiProperty({
    description: 'Number of yes votes',
    example: 5,
  })
  yesCount: number;

  @ApiProperty({
    description: 'Number of no votes',
    example: 2,
  })
  noCount: number;

  @ApiProperty({
    description: 'Detailed yes votes',
    type: [VoteDetailResponseDto],
  })
  yesVotes: VoteDetailResponseDto[];

  @ApiProperty({
    description: 'Detailed no votes',
    type: [VoteDetailResponseDto],
  })
  noVotes: VoteDetailResponseDto[];
}

// Rating votes response DTO
export class RatingVotesResponseDto {
  @ApiProperty({
    description: 'Number of 1-star ratings',
    example: 0,
  })
  rating1Count: number;

  @ApiProperty({
    description: 'Number of 2-star ratings',
    example: 1,
  })
  rating2Count: number;

  @ApiProperty({
    description: 'Number of 3-star ratings',
    example: 2,
  })
  rating3Count: number;

  @ApiProperty({
    description: 'Number of 4-star ratings',
    example: 3,
  })
  rating4Count: number;

  @ApiProperty({
    description: 'Number of 5-star ratings',
    example: 4,
  })
  rating5Count: number;

  @ApiProperty({
    description: 'Average rating',
    example: 4.2,
  })
  averageRating: number;

  @ApiProperty({
    description: 'Total number of ratings',
    example: 10,
  })
  totalRatings: number;

  @ApiProperty({
    description: 'Detailed 1-star ratings',
    type: [VoteDetailResponseDto],
  })
  rating1Votes: VoteDetailResponseDto[];

  @ApiProperty({
    description: 'Detailed 2-star ratings',
    type: [VoteDetailResponseDto],
  })
  rating2Votes: VoteDetailResponseDto[];

  @ApiProperty({
    description: 'Detailed 3-star ratings',
    type: [VoteDetailResponseDto],
  })
  rating3Votes: VoteDetailResponseDto[];

  @ApiProperty({
    description: 'Detailed 4-star ratings',
    type: [VoteDetailResponseDto],
  })
  rating4Votes: VoteDetailResponseDto[];

  @ApiProperty({
    description: 'Detailed 5-star ratings',
    type: [VoteDetailResponseDto],
  })
  rating5Votes: VoteDetailResponseDto[];
}

// Clip voting summary DTO
export class ClipVotingSummaryDto {
  @ApiProperty({
    description: 'Generated clip ID (database ID)',
    example: '507f1f77bcf86cd799439015',
  })
  clipDbId: string;

  @ApiProperty({
    description: 'Generated clip title',
    example: 'Introduction segment',
  })
  clipTitle: string;

  @ApiProperty({
    description: 'Posting votes',
    type: PostingVotesResponseDto,
  })
  postingVotes: PostingVotesResponseDto;

  @ApiProperty({
    description: 'Rating votes',
    type: RatingVotesResponseDto,
  })
  ratingVotes: RatingVotesResponseDto;

  @ApiPropertyOptional({
    description: "Current user's posting vote (if any)",
    enum: ['yes', 'no'],
    example: 'yes',
  })
  currentUserPostingVote?: 'yes' | 'no';

  @ApiPropertyOptional({
    description: "Current user's rating (if any)",
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  currentUserRating?: number;
}

// Project voting summary DTO
export class ProjectVotingSummaryDto {
  @ApiProperty({
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  projectId: string;

  @ApiProperty({
    description: 'Project title',
    example: 'My Podcast Episode',
  })
  projectTitle: string;

  @ApiProperty({
    description: 'Voting summary for each generated clip',
    type: [ClipVotingSummaryDto],
  })
  clips: ClipVotingSummaryDto[];

  @ApiProperty({
    description: 'Total number of clips in the project',
    example: 5,
  })
  totalClips: number;

  @ApiProperty({
    description: 'Number of clips with at least one vote',
    example: 3,
  })
  clipsWithVotes: number;
}

// Vote success response DTO
export class VoteSuccessResponseDto {
  @ApiProperty({
    description: 'Whether the vote was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Message about the vote',
    example: 'Vote recorded successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Type of vote that was cast',
    enum: ['posting', 'rating'],
    example: 'posting',
  })
  voteType: 'posting' | 'rating';

  @ApiPropertyOptional({
    description: 'Previous vote that was replaced (if any)',
    example: 'no',
  })
  previousVote?: string;

  @ApiProperty({
    description: 'New vote value',
    example: 'yes',
  })
  newVote: string;
}

// Remove vote DTO
export class RemoveVoteDto {
  @ApiProperty({
    description: 'Type of vote to remove',
    enum: ['posting', 'rating'],
    example: 'posting',
  })
  @IsEnum(['posting', 'rating'])
  voteType: 'posting' | 'rating';
}

// Voting statistics DTO
export class VotingStatsDto {
  @ApiProperty({
    description: 'Total number of collaborators who can vote',
    example: 5,
  })
  totalVoters: number;

  @ApiProperty({
    description: 'Number of collaborators who have voted on posting',
    example: 3,
  })
  postingVoterCount: number;

  @ApiProperty({
    description: 'Number of collaborators who have rated the clip',
    example: 4,
  })
  ratingVoterCount: number;

  @ApiProperty({
    description: 'Posting vote participation percentage',
    example: 60.0,
  })
  postingParticipationRate: number;

  @ApiProperty({
    description: 'Rating vote participation percentage',
    example: 80.0,
  })
  ratingParticipationRate: number;
}
