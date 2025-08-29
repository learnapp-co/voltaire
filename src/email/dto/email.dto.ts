import { IsEmail, IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'recipient@example.com',
  })
  @IsEmail()
  to: string;

  @ApiProperty({
    description: 'Email subject',
    example: 'Welcome to ClipFlow',
  })
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'Email HTML content',
    example: '<h1>Welcome!</h1><p>Thank you for joining ClipFlow.</p>',
  })
  @IsString()
  html: string;

  @ApiPropertyOptional({
    description: 'Email plain text content',
    example: 'Welcome! Thank you for joining ClipFlow.',
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    description: 'Sender email address',
    example: 'noreply@clipflow.com',
  })
  @IsOptional()
  @IsEmail()
  from?: string;

  @ApiPropertyOptional({
    description: 'CC recipients',
    type: [String],
    example: ['cc1@example.com', 'cc2@example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @ApiPropertyOptional({
    description: 'BCC recipients',
    type: [String],
    example: ['bcc1@example.com', 'bcc2@example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];
}

export class WelcomeEmailDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Temporary password for new user',
    example: 'temp123456',
  })
  @IsString()
  temporaryPassword: string;
}

export class PasswordResetEmailDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Password reset token',
    example: 'abc123-def456-ghi789',
  })
  @IsString()
  resetToken: string;

  @ApiPropertyOptional({
    description: 'Password reset URL',
    example: 'https://clipflow.com/reset-password?token=abc123-def456-ghi789',
  })
  @IsOptional()
  @IsString()
  resetUrl?: string;
}

export class CollaboratorInvitationEmailDto {
  @ApiProperty({
    description: 'Invitee email address',
    example: 'collaborator@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Inviter first name',
    example: 'John',
  })
  @IsString()
  inviterFirstName: string;

  @ApiProperty({
    description: 'Inviter last name',
    example: 'Doe',
  })
  @IsString()
  inviterLastName: string;

  @ApiProperty({
    description: 'Clip project title',
    example: 'My Podcast Episode',
  })
  @IsString()
  projectTitle: string;

  @ApiProperty({
    description: 'Invitation token for verification',
    example: 'inv_abc123def456',
  })
  @IsString()
  invitationToken: string;

  @ApiPropertyOptional({
    description: 'Optional message from inviter',
    example: 'Would you like to collaborate on this clip project?',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Whether the invitee needs to sign up first',
    example: true,
  })
  @IsOptional()
  needsSignup?: boolean;
}

export class EmailResponseDto {
  @ApiProperty({
    description: 'Whether the email was sent successfully',
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Email message ID from provider',
    example: 'msg_12345',
  })
  messageId?: string;

  @ApiPropertyOptional({
    description: 'Error message if email failed',
    example: 'SMTP connection failed',
  })
  error?: string;
}
