import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationStatus } from '../../schemas/invitation.schema';

// Invite Collaborator DTO
export class InviteCollaboratorDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'collaborator@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Optional message to include with the invitation',
    example: 'Would you like to collaborate on this clip project?',
  })
  @IsOptional()
  @IsString()
  message?: string;
}

// Bulk Invite DTO
export class BulkInviteCollaboratorsDto {
  @ApiProperty({
    description: 'Array of email addresses to invite',
    type: [String],
    example: ['user1@example.com', 'user2@example.com'],
  })
  @IsArray()
  @IsEmail({}, { each: true })
  emails: string[];

  @ApiPropertyOptional({
    description: 'Optional message to include with all invitations',
    example: 'Would you like to collaborate on this clip project?',
  })
  @IsOptional()
  @IsString()
  message?: string;
}

// Accept/Decline Invitation DTO
export class RespondToInvitationDto {
  @ApiProperty({
    description: 'Response to the invitation',
    enum: ['accept', 'decline'],
    example: 'accept',
  })
  @IsString()
  response: 'accept' | 'decline';
}

// Collaborator Response DTO
export class CollaboratorResponseDto {
  @ApiProperty({
    description: 'User ID of the collaborator',
    example: '507f1f77bcf86cd799439011',
  })
  userId: string;

  @ApiProperty({
    description: 'Email address',
    example: 'collaborator@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'When the collaborator was added',
  })
  addedAt: Date;

  @ApiProperty({
    description: 'User ID who added this collaborator',
    example: '507f1f77bcf86cd799439012',
  })
  addedBy: string;
}

// Invitation Response DTO
export class InvitationResponseDto {
  @ApiProperty({
    description: 'Invitation ID',
    example: '507f1f77bcf86cd799439013',
  })
  id: string;

  @ApiProperty({
    description: 'Clip project ID',
    example: '507f1f77bcf86cd799439011',
  })
  clipId: string;

  @ApiProperty({
    description: 'Clip project title',
    example: 'My Podcast Episode',
  })
  clipTitle: string;

  @ApiProperty({
    description: 'Email address of the invited user',
    example: 'collaborator@example.com',
  })
  invitedEmail: string;

  @ApiProperty({
    description: 'User who sent the invitation',
    example: {
      userId: '507f1f77bcf86cd799439012',
      email: 'owner@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    },
  })
  invitedBy: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };

  @ApiProperty({
    description: 'Invitation status',
    enum: InvitationStatus,
    example: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @ApiPropertyOptional({
    description: 'Optional message from the inviter',
    example: 'Would you like to collaborate on this clip project?',
  })
  message?: string;

  @ApiProperty({
    description: 'When the invitation was sent',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the invitation expires',
  })
  expiresAt: Date;

  @ApiPropertyOptional({
    description: 'When the invitation was accepted (if applicable)',
  })
  acceptedAt?: Date;

  @ApiPropertyOptional({
    description: 'When the invitation was declined (if applicable)',
  })
  declinedAt?: Date;
}

// List Collaborators Response DTO
export class ListCollaboratorsResponseDto {
  @ApiProperty({
    description: 'Array of collaborators',
    type: [CollaboratorResponseDto],
  })
  collaborators: CollaboratorResponseDto[];

  @ApiProperty({
    description: 'Project owner information',
    example: {
      userId: '507f1f77bcf86cd799439012',
      email: 'owner@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    },
  })
  owner: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };

  @ApiProperty({
    description: 'Total number of collaborators',
    example: 3,
  })
  total: number;
}

// List Invitations Response DTO
export class ListInvitationsResponseDto {
  @ApiProperty({
    description: 'Array of invitations',
    type: [InvitationResponseDto],
  })
  invitations: InvitationResponseDto[];

  @ApiProperty({
    description: 'Total number of invitations',
    example: 5,
  })
  total: number;
}

// Remove Collaborator DTO
export class RemoveCollaboratorDto {
  @ApiProperty({
    description: 'User ID of the collaborator to remove',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  userId: string;
}

// Invitation Success Response DTO
export class InvitationSuccessResponseDto {
  @ApiProperty({
    description: 'Whether the invitation was sent successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Invitation ID',
    example: '507f1f77bcf86cd799439013',
  })
  invitationId: string;

  @ApiProperty({
    description: 'Email address invited',
    example: 'collaborator@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Message about the invitation',
    example: 'Invitation sent successfully',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Whether a new user account was created',
    example: false,
  })
  newUserCreated?: boolean;
}

// Bulk Invitation Response DTO
export class BulkInvitationResponseDto {
  @ApiProperty({
    description: 'Array of successful invitations',
    type: [InvitationSuccessResponseDto],
  })
  successful: InvitationSuccessResponseDto[];

  @ApiProperty({
    description: 'Array of failed invitations',
    example: [
      {
        email: 'invalid@example',
        error: 'Invalid email format',
      },
    ],
  })
  failed: Array<{
    email: string;
    error: string;
  }>;

  @ApiProperty({
    description: 'Total number of invitations attempted',
    example: 5,
  })
  total: number;

  @ApiProperty({
    description: 'Number of successful invitations',
    example: 4,
  })
  successCount: number;

  @ApiProperty({
    description: 'Number of failed invitations',
    example: 1,
  })
  failureCount: number;
}
