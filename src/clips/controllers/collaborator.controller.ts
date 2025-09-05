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
import { CollaboratorService } from '../services/collaborator.service';
import {
  InviteCollaboratorDto,
  BulkInviteCollaboratorsDto,
  ListCollaboratorsResponseDto,
  ListInvitationsResponseDto,
  RemoveCollaboratorDto,
  InvitationSuccessResponseDto,
  BulkInvitationResponseDto,
} from '../dto/collaborator.dto';

@ApiTags('collaborators')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('clips/:id/collaborators')
export class CollaboratorController {
  private readonly logger = new Logger(CollaboratorController.name);

  constructor(private readonly collaboratorService: CollaboratorService) {}

  @Post('invite')
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

  @Post('bulk-invite')
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

  @Get()
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

  @Get('invitations')
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

  @Delete()
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
}
