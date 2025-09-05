import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserDocument } from '../../schemas/user.schema';
import { TitleThumbnailService } from '../services/title-thumbnail.service';
import {
  GenerateTitlesDto,
  GenerateThumbnailHeadersDto,
  AddCustomTitleDto,
  AddCustomThumbnailHeaderDto,
  TitleThumbnailStatusDto,
  GeneratedTitleResponseDto,
  GeneratedThumbnailHeaderResponseDto,
  TitleGenerationResponseDto,
  ThumbnailHeaderGenerationResponseDto,
  TitleThumbnailVoteSuccessDto,
  PollCreationSuccessDto,
  FinalSelectionSuccessDto,
} from '../dto/title-thumbnail.dto';

@ApiTags('title-thumbnail')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('clips/generated/:generatedClipId/title-thumbnail')
export class TitleThumbnailController {
  private readonly logger = new Logger(TitleThumbnailController.name);

  constructor(private readonly titleThumbnailService: TitleThumbnailService) {}

  // =============================================================================
  // GENERATION ENDPOINTS
  // =============================================================================

  @Post('titles/generate')
  @ApiOperation({
    summary: 'Generate titles for a clip',
    description:
      'Generate 10 titles using AI based on selected tones and model',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiBody({
    description: 'Title generation parameters',
    type: GenerateTitlesDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Titles generated successfully',
    type: TitleGenerationResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async generateTitles(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
    @Body() generateDto: GenerateTitlesDto,
  ): Promise<TitleGenerationResponseDto> {
    this.logger.log(
      `User ${user.email} generating titles for clip ${generatedClipId} using ${generateDto.aiModel}`,
    );

    return this.titleThumbnailService.generateTitles(
      generatedClipId,
      generateDto,
      user._id.toString(),
    );
  }

  @Post('thumbnails/generate')
  @ApiOperation({
    summary: 'Generate thumbnail headers for a clip',
    description:
      'Generate 20 thumbnail headers using AI based on selected tones and model',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiBody({
    description: 'Thumbnail header generation parameters',
    type: GenerateThumbnailHeadersDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Thumbnail headers generated successfully',
    type: ThumbnailHeaderGenerationResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async generateThumbnailHeaders(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
    @Body() generateDto: GenerateThumbnailHeadersDto,
  ): Promise<ThumbnailHeaderGenerationResponseDto> {
    this.logger.log(
      `User ${user.email} generating thumbnail headers for clip ${generatedClipId} using ${generateDto.aiModel}`,
    );

    return this.titleThumbnailService.generateThumbnailHeaders(
      generatedClipId,
      generateDto,
      user._id.toString(),
    );
  }

  // =============================================================================
  // CUSTOM CONTENT ENDPOINTS
  // =============================================================================

  @Post('titles/custom')
  @ApiOperation({
    summary: 'Add custom title',
    description: 'Add a custom title manually created by the user',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiBody({
    description: 'Custom title data',
    type: AddCustomTitleDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Custom title added successfully',
    type: GeneratedTitleResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async addCustomTitle(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
    @Body() customTitleDto: AddCustomTitleDto,
  ): Promise<GeneratedTitleResponseDto> {
    this.logger.log(
      `User ${user.email} adding custom title for clip ${generatedClipId}: "${customTitleDto.text}"`,
    );

    return this.titleThumbnailService.addCustomTitle(
      generatedClipId,
      customTitleDto,
      user._id.toString(),
    );
  }

  @Post('thumbnails/custom')
  @ApiOperation({
    summary: 'Add custom thumbnail header',
    description: 'Add a custom thumbnail header manually created by the user',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiBody({
    description: 'Custom thumbnail header data',
    type: AddCustomThumbnailHeaderDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Custom thumbnail header added successfully',
    type: GeneratedThumbnailHeaderResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async addCustomThumbnailHeader(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
    @Body() customHeaderDto: AddCustomThumbnailHeaderDto,
  ): Promise<GeneratedThumbnailHeaderResponseDto> {
    this.logger.log(
      `User ${user.email} adding custom thumbnail header for clip ${generatedClipId}: "${customHeaderDto.text}"`,
    );

    return this.titleThumbnailService.addCustomThumbnailHeader(
      generatedClipId,
      customHeaderDto,
      user._id.toString(),
    );
  }

  // =============================================================================
  // STATUS ENDPOINTS
  // =============================================================================

  @Get('status')
  @ApiOperation({
    summary: 'Get title and thumbnail status',
    description:
      'Get complete status of title/thumbnail generation and voting for a clip',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  @ApiResponse({
    status: 200,
    description: 'Status retrieved successfully',
    type: TitleThumbnailStatusDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getStatus(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
  ): Promise<TitleThumbnailStatusDto> {
    this.logger.log(
      `User ${user.email} requesting title/thumbnail status for clip ${generatedClipId}`,
    );

    return this.titleThumbnailService.getTitleThumbnailStatus(
      generatedClipId,
      user._id.toString(),
    );
  }

  // =============================================================================
  // POLL MANAGEMENT ENDPOINTS (Placeholder - to be implemented)
  // =============================================================================

  @Post('titles/poll/create')
  @ApiOperation({
    summary: 'Create title poll',
    description: 'Create a poll for title selection with up to 20 options',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  // TODO: Add @ApiBody when poll creation is implemented
  @ApiResponse({
    status: 201,
    description: 'Title poll created successfully',
    type: PollCreationSuccessDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async createTitlePoll(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
  ): Promise<PollCreationSuccessDto> {
    this.logger.log(
      `User ${user.email} creating title poll for clip ${generatedClipId}`,
    );

    // TODO: Implement poll creation logic
    throw new Error('Poll creation not yet implemented');
  }

  @Post('thumbnails/poll/create')
  @ApiOperation({
    summary: 'Create thumbnail header poll',
    description:
      'Create a poll for thumbnail header selection with up to 20 options',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  // TODO: Add @ApiBody when poll creation is implemented
  @ApiResponse({
    status: 201,
    description: 'Thumbnail header poll created successfully',
    type: PollCreationSuccessDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async createThumbnailPoll(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
  ): Promise<PollCreationSuccessDto> {
    this.logger.log(
      `User ${user.email} creating thumbnail header poll for clip ${generatedClipId}`,
    );

    // TODO: Implement poll creation logic
    throw new Error('Poll creation not yet implemented');
  }

  // =============================================================================
  // VOTING ENDPOINTS (Placeholder - to be implemented)
  // =============================================================================

  @Post('titles/vote')
  @ApiOperation({
    summary: 'Vote for titles',
    description: 'Cast votes for one or more title options',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  // TODO: Add @ApiBody when voting is implemented
  @ApiResponse({
    status: 200,
    description: 'Vote recorded successfully',
    type: TitleThumbnailVoteSuccessDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async voteForTitles(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
  ): Promise<TitleThumbnailVoteSuccessDto> {
    this.logger.log(
      `User ${user.email} voting for titles in clip ${generatedClipId}`,
    );

    // TODO: Implement voting logic
    throw new Error('Voting not yet implemented');
  }

  @Post('thumbnails/vote')
  @ApiOperation({
    summary: 'Vote for thumbnail headers',
    description: 'Cast votes for one or more thumbnail header options',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  // TODO: Add @ApiBody when voting is implemented
  @ApiResponse({
    status: 200,
    description: 'Vote recorded successfully',
    type: TitleThumbnailVoteSuccessDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async voteForThumbnailHeaders(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
  ): Promise<TitleThumbnailVoteSuccessDto> {
    this.logger.log(
      `User ${user.email} voting for thumbnail headers in clip ${generatedClipId}`,
    );

    // TODO: Implement voting logic
    throw new Error('Voting not yet implemented');
  }

  // =============================================================================
  // FINAL SELECTION ENDPOINTS (Placeholder - to be implemented)
  // =============================================================================

  @Put('titles/select-final')
  @ApiOperation({
    summary: 'Select final title',
    description: 'Select the final title and mark as saved',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  // TODO: Add @ApiBody when final selection is implemented
  @ApiResponse({
    status: 200,
    description: 'Final title selected successfully',
    type: FinalSelectionSuccessDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async selectFinalTitle(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
  ): Promise<FinalSelectionSuccessDto> {
    this.logger.log(
      `User ${user.email} selecting final title for clip ${generatedClipId}`,
    );

    // TODO: Implement final selection logic
    throw new Error('Final selection not yet implemented');
  }

  @Put('thumbnails/select-final')
  @ApiOperation({
    summary: 'Select final thumbnail header',
    description: 'Select the final thumbnail header and mark as saved',
  })
  @ApiParam({
    name: 'generatedClipId',
    description: 'Generated clip ID',
    example: '60d5ecb74f3b2c001f5e4e8b',
  })
  // TODO: Add @ApiBody when final selection is implemented
  @ApiResponse({
    status: 200,
    description: 'Final thumbnail header selected successfully',
    type: FinalSelectionSuccessDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied - not a collaborator',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async selectFinalThumbnailHeader(
    @CurrentUser() user: UserDocument,
    @Param('generatedClipId') generatedClipId: string,
  ): Promise<FinalSelectionSuccessDto> {
    this.logger.log(
      `User ${user.email} selecting final thumbnail header for clip ${generatedClipId}`,
    );

    // TODO: Implement final selection logic
    throw new Error('Final selection not yet implemented');
  }
}
