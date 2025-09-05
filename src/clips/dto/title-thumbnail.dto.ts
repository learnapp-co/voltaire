import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  MaxLength,
  MinLength,
  ArrayMaxSize,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { AIModel, TitleTone } from '../../schemas/clip.schema';

// ===== Request DTOs =====

export class GenerateTitlesDto {
  @ApiProperty({
    description: 'AI model to use for generation',
    enum: AIModel,
    example: AIModel.GPT_4O,
  })
  @IsEnum(AIModel)
  aiModel: AIModel;

  @ApiProperty({
    description: 'Selected tones for title generation',
    type: [String],
    example: [TitleTone.EDUCATIONAL, TitleTone.INSPIRATIONAL],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  selectedTones: string[];

  @ApiPropertyOptional({
    description: 'Custom tone (single word)',
    example: 'Dramatic',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  customTone?: string;
}

export class GenerateThumbnailHeadersDto {
  @ApiProperty({
    description: 'AI model to use for generation',
    enum: AIModel,
    example: AIModel.GPT_4O,
  })
  @IsEnum(AIModel)
  aiModel: AIModel;

  @ApiProperty({
    description: 'Selected tones for thumbnail header generation',
    type: [String],
    example: [TitleTone.BOLD_CONTROVERSIAL, TitleTone.URGENT_TIMELY],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  selectedTones: string[];

  @ApiPropertyOptional({
    description: 'Custom tone (single word)',
    example: 'Shocking',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  customTone?: string;
}

export class AddCustomTitleDto {
  @ApiProperty({
    description: 'Custom title text (supports emojis)',
    example: '🚀 Amazing Discovery That Changed Everything!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(100)
  text: string;

  @ApiProperty({
    description: 'Tone associated with this custom title',
    example: 'Dramatic',
  })
  @IsString()
  @IsNotEmpty()
  tone: string;
}

export class AddCustomThumbnailHeaderDto {
  @ApiProperty({
    description: 'Custom thumbnail header text (supports emojis)',
    example: '💥 MIND-BLOWING REVELATION 💥',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(80)
  text: string;

  @ApiProperty({
    description: 'Tone associated with this custom thumbnail header',
    example: 'Explosive',
  })
  @IsString()
  @IsNotEmpty()
  tone: string;
}

export class CreateTitlePollDto {
  @ApiProperty({
    description: 'Array of title IDs to include in poll (max 20)',
    type: [String],
    example: ['title1', 'title2', 'title3'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  titleIds: string[];
}

export class CreateThumbnailPollDto {
  @ApiProperty({
    description: 'Array of thumbnail header IDs to include in poll (max 20)',
    type: [String],
    example: ['header1', 'header2', 'header3'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  thumbnailHeaderIds: string[];
}

export class VoteForTitlesDto {
  @ApiProperty({
    description: 'Array of title IDs being voted for',
    type: [String],
    example: ['title1', 'title3'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  selectedTitleIds: string[];
}

export class VoteForThumbnailHeadersDto {
  @ApiProperty({
    description: 'Array of thumbnail header IDs being voted for',
    type: [String],
    example: ['header2', 'header4'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  selectedThumbnailHeaderIds: string[];
}

export class SelectFinalTitleDto {
  @ApiProperty({
    description: 'Final selected title ID',
    example: 'title_507f1f77bcf86cd799439015',
  })
  @IsString()
  @IsNotEmpty()
  finalTitleId: string;
}

export class SelectFinalThumbnailHeaderDto {
  @ApiProperty({
    description: 'Final selected thumbnail header ID',
    example: 'header_507f1f77bcf86cd799439016',
  })
  @IsString()
  @IsNotEmpty()
  finalThumbnailHeaderId: string;
}

// ===== Response DTOs =====

export class GeneratedTitleResponseDto {
  @ApiProperty({
    description: 'Unique identifier for this title',
    example: 'title_507f1f77bcf86cd799439015',
  })
  id: string;

  @ApiProperty({
    description: 'Generated title text',
    example: 'The Surprising Truth About AI That Nobody Talks About',
  })
  text: string;

  @ApiProperty({
    description: 'Tone used for generation',
    example: 'Educational',
  })
  tone: string;

  @ApiProperty({
    description: 'AI model used for generation',
    enum: AIModel,
    example: AIModel.GPT_4O,
  })
  aiModel: AIModel;

  @ApiProperty({
    description: 'Generation timestamp',
    example: '2023-12-07T10:30:00Z',
  })
  generatedAt: Date;

  @ApiProperty({
    description: 'Whether this is a custom title added by user',
    example: false,
  })
  isCustom: boolean;
}

export class GeneratedThumbnailHeaderResponseDto {
  @ApiProperty({
    description: 'Unique identifier for this thumbnail header',
    example: 'header_507f1f77bcf86cd799439016',
  })
  id: string;

  @ApiProperty({
    description: 'Generated thumbnail header text',
    example: 'AI SECRETS REVEALED',
  })
  text: string;

  @ApiProperty({
    description: 'Tone used for generation',
    example: 'Bold & Controversial',
  })
  tone: string;

  @ApiProperty({
    description: 'AI model used for generation',
    enum: AIModel,
    example: AIModel.CLAUDE,
  })
  aiModel: AIModel;

  @ApiProperty({
    description: 'Generation timestamp',
    example: '2023-12-07T10:30:00Z',
  })
  generatedAt: Date;

  @ApiProperty({
    description: 'Whether this is a custom header added by user',
    example: false,
  })
  isCustom: boolean;
}

export class TitleGenerationResponseDto {
  @ApiProperty({
    description: 'Array of generated titles',
    type: [GeneratedTitleResponseDto],
  })
  titles: GeneratedTitleResponseDto[];

  @ApiProperty({
    description: 'Total number of titles generated',
    example: 10,
  })
  totalGenerated: number;
}

export class ThumbnailHeaderGenerationResponseDto {
  @ApiProperty({
    description: 'Array of generated thumbnail headers',
    type: [GeneratedThumbnailHeaderResponseDto],
  })
  thumbnailHeaders: GeneratedThumbnailHeaderResponseDto[];

  @ApiProperty({
    description: 'Total number of thumbnail headers generated',
    example: 20,
  })
  totalGenerated: number;
}

export class VoteDetailResponseDto {
  @ApiProperty({
    description: 'Voter user ID',
    example: '507f1f77bcf86cd799439011',
  })
  userId: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  userEmail: string;

  @ApiProperty({
    description: 'Vote timestamp',
    example: '2023-12-07T11:00:00Z',
  })
  votedAt: Date;

  @ApiProperty({
    description: 'Array of option IDs this user voted for',
    type: [String],
    example: ['title1', 'title3'],
  })
  selectedOptions: string[];
}

export class TitlePollStatusDto {
  @ApiProperty({
    description: 'Whether poll is active',
    example: true,
  })
  isPollActive: boolean;

  @ApiProperty({
    description: 'Poll creation timestamp',
    example: '2023-12-07T10:00:00Z',
  })
  pollCreatedAt?: Date;

  @ApiProperty({
    description: 'Poll deadline',
    example: '2023-12-07T11:00:00Z',
  })
  pollDeadline?: Date;

  @ApiProperty({
    description: 'Array of title IDs included in poll',
    type: [String],
    example: ['title1', 'title2', 'title3'],
  })
  pollOptions: string[];

  @ApiProperty({
    description: 'Array of all votes cast',
    type: [VoteDetailResponseDto],
  })
  votes: VoteDetailResponseDto[];

  @ApiProperty({
    description: 'Whether poll is closed',
    example: false,
  })
  isPollClosed: boolean;

  @ApiProperty({
    description: 'Final selected title ID',
    example: 'title1',
  })
  finalSelection?: string;

  @ApiProperty({
    description: 'Whether final selection is saved',
    example: false,
  })
  isSaved: boolean;
}

export class ThumbnailPollStatusDto {
  @ApiProperty({
    description: 'Whether poll is active',
    example: true,
  })
  isPollActive: boolean;

  @ApiProperty({
    description: 'Poll creation timestamp',
    example: '2023-12-07T10:00:00Z',
  })
  pollCreatedAt?: Date;

  @ApiProperty({
    description: 'Poll deadline',
    example: '2023-12-07T11:00:00Z',
  })
  pollDeadline?: Date;

  @ApiProperty({
    description: 'Array of thumbnail header IDs included in poll',
    type: [String],
    example: ['header1', 'header2', 'header3'],
  })
  pollOptions: string[];

  @ApiProperty({
    description: 'Array of all votes cast',
    type: [VoteDetailResponseDto],
  })
  votes: VoteDetailResponseDto[];

  @ApiProperty({
    description: 'Whether poll is closed',
    example: false,
  })
  isPollClosed: boolean;

  @ApiProperty({
    description: 'Final selected thumbnail header ID',
    example: 'header2',
  })
  finalSelection?: string;

  @ApiProperty({
    description: 'Whether final selection is saved',
    example: false,
  })
  isSaved: boolean;
}

export class TitleThumbnailStatusDto {
  @ApiProperty({
    description: 'All available titles',
    type: [GeneratedTitleResponseDto],
  })
  titles: GeneratedTitleResponseDto[];

  @ApiProperty({
    description: 'All available thumbnail headers',
    type: [GeneratedThumbnailHeaderResponseDto],
  })
  thumbnailHeaders: GeneratedThumbnailHeaderResponseDto[];

  @ApiProperty({
    description: 'Currently selected tones',
    type: [String],
    example: ['Educational', 'Inspirational'],
  })
  selectedTones: string[];

  @ApiProperty({
    description: 'Currently selected AI model',
    enum: AIModel,
    example: AIModel.GPT_4O,
  })
  selectedAIModel: AIModel;

  @ApiProperty({
    description: 'Title poll status',
    type: TitlePollStatusDto,
  })
  titlePoll: TitlePollStatusDto;

  @ApiProperty({
    description: 'Thumbnail poll status',
    type: ThumbnailPollStatusDto,
  })
  thumbnailPoll: ThumbnailPollStatusDto;

  @ApiProperty({
    description: 'Whether both title and thumbnail are completed and saved',
    example: false,
  })
  isComplete: boolean;

  @ApiProperty({
    description: 'Whether user can move to next milestone',
    example: false,
  })
  canMoveToNextMilestone: boolean;
}

export class TitleThumbnailVoteSuccessDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Vote recorded successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Type of vote cast',
    example: 'title',
  })
  voteType: 'title' | 'thumbnail';

  @ApiProperty({
    description: 'Array of selected option IDs',
    type: [String],
    example: ['title1', 'title3'],
  })
  selectedOptions: string[];
}

export class PollCreationSuccessDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Poll created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Type of poll created',
    example: 'title',
  })
  pollType: 'title' | 'thumbnail';

  @ApiProperty({
    description: 'Poll deadline',
    example: '2023-12-07T11:00:00Z',
  })
  pollDeadline: Date;

  @ApiProperty({
    description: 'Number of options in poll',
    example: 5,
  })
  optionCount: number;
}

export class FinalSelectionSuccessDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Final selection saved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Type of selection made',
    example: 'title',
  })
  selectionType: 'title' | 'thumbnail';

  @ApiProperty({
    description: 'Selected option ID',
    example: 'title_507f1f77bcf86cd799439015',
  })
  selectedOptionId: string;

  @ApiProperty({
    description: 'Whether user can now move to next milestone',
    example: false,
  })
  canMoveToNextMilestone: boolean;
}
