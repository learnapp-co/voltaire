import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import {
  LoginDto,
  CreateUserDto,
  RegisterDto,
  JwtPayload,
  AuthResponseDto,
  CreateUserResponseDto,
} from './dto/auth.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  /**
   * Generate a random password
   */
  private generateRandomPassword(length: number = 12): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      this.logger.error(`Error hashing password: ${error.message}`);
      throw new InternalServerErrorException('Error processing password');
    }
  }

  /**
   * Verify password against hashed password
   */
  async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      this.logger.error(`Error verifying password: ${error.message}`);
      return false;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({ email: email.toLowerCase() });
    } catch (error) {
      this.logger.error(`Error getting user by email: ${error.message}`);
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findById(id).exec();
    } catch (error) {
      this.logger.error(`Error getting user by ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.verifyPassword(
      password,
      user.hashedPassword,
    );
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Create access token
   */
  createAccessToken(user: UserDocument): string {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * Create password reset token
   */
  private createResetToken(user: UserDocument): string {
    const payload = {
      sub: user._id.toString(),
      type: 'password_reset',
    };
    // Use user's hashed password as part of the secret to invalidate token if password changes
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET + user.hashedPassword,
      expiresIn: '15m',
    });
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(token: string): Promise<UserDocument> {
    try {
      // First decode without verification to get user ID
      const unverifiedPayload = this.jwtService.decode(token) as any;
      if (!unverifiedPayload?.sub) {
        throw new BadRequestException('Invalid token format');
      }

      // Get user by ID
      const user = await this.getUserById(unverifiedPayload.sub);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if token has expired by checking the user's reset token expiry
      if (user.resetTokenExpires && user.resetTokenExpires < new Date()) {
        throw new BadRequestException('Token has expired');
      }

      // Verify token with user's password hash as part of secret
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET + user.hashedPassword,
      });

      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Invalid token type');
      }

      return user;
    } catch (error) {
      this.logger.error(`Error verifying reset token: ${error.message}`);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Invalid or expired token');
    }
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.authenticateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const accessToken = this.createAccessToken(user);

    return {
      accessToken,
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

  /**
   * Register a new user (public registration)
   */
  async registerUser(registerDto: RegisterDto): Promise<CreateUserResponseDto> {
    const { email, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Generate random password
    const temporaryPassword = this.generateRandomPassword();
    const hashedPassword = await this.hashPassword(temporaryPassword);

    // Create user
    const userData = {
      email: email.toLowerCase(),
      firstName,
      lastName,
      hashedPassword,
      isActive: true,
      isAdmin: false,
      requiresPasswordChange: true,
    };

    const user = new this.userModel(userData);
    await user.save();

    this.logger.log(`User registered successfully: ${email}`);

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail({
        email: user.email,
        firstName: user.firstName,
        temporaryPassword,
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.warn(
        `Failed to send welcome email to ${email}: ${error.message}`,
      );
      // Don't fail registration if email fails
    }

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
        requiresPasswordChange: user.requiresPasswordChange,
      },
      temporaryPassword,
    };
  }

  /**
   * Create a new user with random password (admin function)
   */
  async createUser(
    createUserDto: CreateUserDto,
  ): Promise<CreateUserResponseDto> {
    const { email, firstName, lastName, ...rest } = createUserDto;

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Generate random password
    const temporaryPassword = this.generateRandomPassword();
    const hashedPassword = await this.hashPassword(temporaryPassword);

    // Create user
    const userData = {
      email: email.toLowerCase(),
      firstName,
      lastName,
      hashedPassword,
      isActive: rest.isActive ?? true,
      isAdmin: rest.isAdmin ?? false,
      requiresPasswordChange: rest.requiresPasswordChange ?? true,
    };

    const user = new this.userModel(userData);
    await user.save();

    this.logger.log(`User created successfully: ${email}`);

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail({
        email: user.email,
        firstName: user.firstName,
        temporaryPassword,
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.warn(
        `Failed to send welcome email to ${email}: ${error.message}`,
      );
      // Don't fail user creation if email fails
    }

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
        requiresPasswordChange: user.requiresPasswordChange,
      },
      temporaryPassword,
    };
  }

  /**
   * Create password reset token for user
   */
  async createPasswordResetToken(
    email: string,
  ): Promise<{ token: string; user: UserDocument }> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Set token expiration
    const resetTokenExpires = new Date();
    resetTokenExpires.setMinutes(resetTokenExpires.getMinutes() + 15);

    // Update user with reset token expiration
    user.resetTokenExpires = resetTokenExpires;
    await user.save();

    // Create token
    const token = this.createResetToken(user);

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail({
        email: user.email,
        firstName: user.firstName,
        resetToken: token,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.warn(
        `Failed to send password reset email to ${email}: ${error.message}`,
      );
      // Don't fail the process if email fails, but log it
    }

    this.logger.log(`Password reset token created for user: ${email}`);
    return { token, user };
  }

  /**
   * Reset password using reset token
   */
  async resetPasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<UserDocument> {
    try {
      // Verify token and get user
      const user = await this.verifyPasswordResetToken(token);

      // Update password
      user.hashedPassword = await this.hashPassword(newPassword);
      user.resetTokenExpires = undefined;
      user.requiresPasswordChange = false;

      await user.save();

      this.logger.log(`Password reset successful for user: ${user.email}`);
      return user;
    } catch (error) {
      this.logger.error(`Error during password reset: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user password (for authenticated users)
   */
  async updateUserPassword(
    user: UserDocument,
    newPassword: string,
  ): Promise<UserDocument> {
    try {
      // Update password
      user.hashedPassword = await this.hashPassword(newPassword);
      user.requiresPasswordChange = false;

      await user.save();

      this.logger.log(`Password updated successfully for user: ${user.email}`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating password: ${error.message}`);
      throw new InternalServerErrorException('Error updating password');
    }
  }

  /**
   * Reset user password (generate new random password)
   */
  async resetUserPassword(email: string): Promise<string> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate new random password
    const newPassword = this.generateRandomPassword();
    user.hashedPassword = await this.hashPassword(newPassword);
    user.requiresPasswordChange = true;

    await user.save();

    this.logger.log(`Password reset for user: ${email}`);
    return newPassword;
  }

  /**
   * Validate user for JWT strategy
   */
  async validateUser(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.getUserById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
