import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  CreateUserDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  TokenResponseDto,
  UserResponseDto,
  RegisterResponseDto,
  MessageResponseDto,
  PasswordResetResponseDto,
  TokenVerificationResponseDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { UserDocument } from '../schemas/user.schema';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  /**
   * Register a new user
   */
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<RegisterResponseDto> {
    this.logger.log(`Registration attempt for email: ${registerDto.email}`);
    try {
      const result = await this.authService.registerUser(registerDto);

      // TODO: Send welcome email with temporary password
      this.logger.log(`Welcome email should be sent to ${registerDto.email}`);

      return {
        message:
          'User registered successfully. Check your email for login credentials.',
        email: result.user.email,
      };
    } catch (error) {
      this.logger.error(`Registration error: ${error.message}`);
      throw error;
    }
  }

  /**
   * OAuth2 compatible token login
   */
  @ApiOperation({ summary: 'Login and get access token' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @Public()
  @Post('token')
  @HttpCode(HttpStatus.OK)
  async loginForAccessToken(
    @Body() loginDto: LoginDto,
  ): Promise<TokenResponseDto> {
    this.logger.log(`Token login attempt for email: ${loginDto.email}`);
    const result = await this.authService.login(loginDto);

    return {
      access_token: result.accessToken,
      token_type: 'bearer',
      requires_password_change: result.user.requiresPasswordChange,
    };
  }

  /**
   * Get current user information
   */
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
    type: UserResponseDto,
  })
  @ApiBearerAuth('JWT-auth')
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(
    @CurrentUser() user: UserDocument,
  ): Promise<UserResponseDto> {
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      is_active: user.isActive,
      is_admin: user.isAdmin,
      created_at: user.createdAt,
    };
  }

  /**
   * Create new user (Admin only)
   */
  @ApiOperation({ summary: 'Create new user (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
  })
  @ApiBearerAuth('JWT-auth')
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @Post('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createUser(@Body() createUserDto: CreateUserDto) {
    this.logger.log(`Admin creating new user: ${createUserDto.email}`);
    const result = await this.authService.createUser(createUserDto);

    return {
      message: 'User created successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        isActive: result.user.isActive,
        isAdmin: result.user.isAdmin,
        requiresPasswordChange: result.user.requiresPasswordChange,
      },
      temporaryPassword: result.temporaryPassword,
    };
  }

  /**
   * Send password reset link to user's email
   */
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid email address' })
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    this.logger.log(`Password reset requested for: ${forgotPasswordDto.email}`);

    try {
      const { user } = await this.authService.createPasswordResetToken(
        forgotPasswordDto.email,
      );

      // TODO: Send password reset email
      this.logger.log(`Password reset email should be sent to ${user.email}`);

      return {
        message: 'Password reset link has been sent to your email address.',
      } as MessageResponseDto;
    } catch (error) {
      this.logger.error(`Forgot password error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset password using token from email
   */
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid token or password' })
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    this.logger.log('Password reset with token attempt');

    try {
      await this.authService.resetPasswordWithToken(
        resetPasswordDto.token,
        resetPasswordDto.newPassword,
      );

      return {
        message:
          'Password reset successfully. You can now log in with your new password.',
      } as MessageResponseDto;
    } catch (error) {
      this.logger.error(`Password reset error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change password using current user's access token
   */
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: MessageResponseDto,
  })
  @ApiBearerAuth('JWT-auth')
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  @ApiBadRequestResponse({ description: 'Invalid password format' })
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: UserDocument,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    this.logger.log(`Password change for user: ${user.email}`);

    try {
      await this.authService.updateUserPassword(
        user,
        changePasswordDto.newPassword,
      );

      return {
        message: 'Password changed successfully.',
      } as MessageResponseDto;
    } catch (error) {
      this.logger.error(`Password change error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Admin endpoint to reset user password
   */
  @ApiOperation({ summary: 'Admin reset user password' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    type: PasswordResetResponseDto,
  })
  @ApiBearerAuth('JWT-auth')
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  @ApiForbiddenResponse({ description: 'Admin access required' })
  @ApiBadRequestResponse({ description: 'Invalid email address' })
  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async adminResetPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    this.logger.log(`Admin password reset for: ${forgotPasswordDto.email}`);
    const newPassword = await this.authService.resetUserPassword(
      forgotPasswordDto.email,
    );

    return {
      message: 'Password reset successful',
      temporaryPassword: newPassword,
    } as PasswordResetResponseDto;
  }

  /**
   * Verify token endpoint (useful for frontend to check token validity)
   */
  @ApiOperation({ summary: 'Verify JWT token validity' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    type: TokenVerificationResponseDto,
  })
  @ApiBearerAuth('JWT-auth')
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyToken(
    @CurrentUser() user: UserDocument,
  ): Promise<TokenVerificationResponseDto> {
    return {
      valid: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
        requiresPasswordChange: user.requiresPasswordChange,
      },
    };
  }
}
