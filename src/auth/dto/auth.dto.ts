import {
  IsEmail,
  IsString,
  MinLength,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    minLength: 6,
    example: 'password123',
  })
  @IsString()
  @MinLength(6)
  password: string;
}

export class CreateUserDto {
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
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({
    description: 'Whether the user is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user is an admin',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user needs to change password',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresPasswordChange?: boolean;
}

export class RegisterDto {
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
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  lastName: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User email address to send password reset link',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token from email',
    example: 'abc123-def456-ghi789',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password',
    minLength: 6,
    example: 'newPassword123',
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'New password to set',
    minLength: 6,
    example: 'newPassword123',
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenData {
  userId: string;
}

// Response DTOs
export class TokenResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'Token type',
    example: 'bearer',
  })
  token_type: string;

  @ApiProperty({
    description: 'Whether user needs to change password',
    example: false,
  })
  requires_password_change: boolean;
}

export class UserResponseDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  lastName: string;

  @ApiProperty({
    description: 'Whether the user is active',
    example: true,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Whether the user is an admin',
    example: false,
  })
  is_admin: boolean;

  @ApiPropertyOptional({
    description: 'User creation date',
    example: '2023-01-01T00:00:00.000Z',
  })
  created_at?: Date;
}

export class RegisterResponseDto {
  @ApiProperty({
    description: 'Success message',
    example:
      'User registered successfully. Check your email for login credentials.',
  })
  message: string;

  @ApiProperty({
    description: 'Registered user email',
    example: 'user@example.com',
  })
  email: string;
}

export class AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    isAdmin: boolean;
    requiresPasswordChange: boolean;
  };
}

export class CreateUserResponseDto {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    isAdmin: boolean;
    requiresPasswordChange: boolean;
  };
  temporaryPassword: string;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation completed successfully',
  })
  message: string;
}

export class PasswordResetResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Password reset successful',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Temporary password (admin reset only)',
    example: 'temp123456',
  })
  temporaryPassword?: string;
}

export class TokenVerificationResponseDto {
  valid: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    isAdmin: boolean;
    requiresPasswordChange: boolean;
  };
}
