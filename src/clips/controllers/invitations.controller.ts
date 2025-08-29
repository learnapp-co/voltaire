import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Logger,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserDocument } from '../../schemas/user.schema';
import { CollaboratorService } from '../services/collaborator.service';
import { InvitationResponseDto } from '../dto/collaborator.dto';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  private readonly logger = new Logger(InvitationsController.name);

  constructor(private readonly collaboratorService: CollaboratorService) {}

  @Get('accept')
  @ApiOperation({
    summary: 'Accept invitation page',
    description:
      'Get invitation details for the invitation acceptance page (public endpoint)',
  })
  @ApiQuery({
    name: 'token',
    description: 'Invitation token',
    example: 'inv_abc123def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation details retrieved',
    type: InvitationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired invitation token',
  })
  async getInvitationDetails(
    @Query('token') token: string,
  ): Promise<InvitationResponseDto> {
    if (!token) {
      throw new BadRequestException('Invitation token is required');
    }

    this.logger.log(
      `Getting invitation details for token: ${token.substring(0, 10)}...`,
    );

    // This would need to be implemented in the collaborator service
    // For now, returning a placeholder - you'll need to implement this
    throw new BadRequestException(
      'Invitation details endpoint not yet implemented',
    );
  }

  @Post('respond')
  @ApiOperation({
    summary: 'Respond to invitation (public endpoint)',
    description:
      'Accept or decline an invitation without requiring authentication',
  })
  @ApiBody({
    description: 'Invitation response',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Invitation token',
          example: 'inv_abc123def456',
        },
        response: {
          type: 'string',
          enum: ['accept', 'decline'],
          description: 'Response to invitation',
          example: 'accept',
        },
      },
      required: ['token', 'response'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation response processed',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
          example: 'Please complete signup to accept the invitation',
        },
        clipId: {
          type: 'string',
          example: '507f1f77bcf86cd799439011',
        },
        needsSignup: {
          type: 'boolean',
          example: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid invitation token or response',
  })
  async respondToInvitation(
    @Body() body: { token: string; response: 'accept' | 'decline' },
  ): Promise<{
    success: boolean;
    message: string;
    clipId?: string;
    needsSignup?: boolean;
  }> {
    if (!body.token || !body.response) {
      throw new BadRequestException('Token and response are required');
    }

    this.logger.log(
      `Processing invitation response: ${body.response} for token: ${body.token.substring(0, 10)}...`,
    );

    const result = await this.collaboratorService.respondToInvitation(
      body.token,
      { response: body.response },
    );

    // If declining, no need for signup
    if (body.response === 'decline') {
      return result;
    }

    // If accepting but no user ID provided, user needs to signup
    return {
      ...result,
      needsSignup: !result.clipId, // If no clipId returned, means user needs to signup first
    };
  }

  @Post('accept-authenticated')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Accept invitation (authenticated)',
    description: 'Accept an invitation for an authenticated user',
  })
  @ApiBody({
    description: 'Invitation acceptance',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Invitation token',
          example: 'inv_abc123def456',
        },
      },
      required: ['token'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
          example: 'Invitation accepted successfully',
        },
        clipId: {
          type: 'string',
          example: '507f1f77bcf86cd799439011',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid invitation token',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async acceptInvitationAuthenticated(
    @CurrentUser() user: UserDocument,
    @Body() body: { token: string },
  ): Promise<{
    success: boolean;
    message: string;
    clipId?: string;
  }> {
    if (!body.token) {
      throw new BadRequestException('Invitation token is required');
    }

    this.logger.log(
      `User ${user.email} accepting invitation with token: ${body.token.substring(0, 10)}...`,
    );

    return this.collaboratorService.respondToInvitation(
      body.token,
      { response: 'accept' },
      user._id.toString(),
    );
  }
}
