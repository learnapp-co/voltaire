import { Injectable, Logger } from '@nestjs/common';
import { ResendService } from './services/resend.service';
import {
  SendEmailDto,
  WelcomeEmailDto,
  PasswordResetEmailDto,
  CollaboratorInvitationEmailDto,
  EmailResponseDto,
} from './dto/email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly resendService: ResendService) {
    this.logger.log('📧 EmailService initialized with Resend API');
  }

  /**
   * Send a generic email
   */
  async sendEmail(data: SendEmailDto): Promise<EmailResponseDto> {
    return this.resendService.sendTestEmail(data.to);
  }

  /**
   * Send welcome email with temporary password
   */
  async sendWelcomeEmail(data: WelcomeEmailDto): Promise<EmailResponseDto> {
    this.logger.log(`📧 Sending welcome email to ${data.email}`);
    return this.resendService.sendWelcomeEmail(data);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    data: PasswordResetEmailDto,
  ): Promise<EmailResponseDto> {
    this.logger.log(`📧 Sending password reset email to ${data.email}`);
    return this.resendService.sendPasswordResetEmail(data);
  }

  /**
   * Send collaborator invitation email
   */
  async sendCollaboratorInvitation(
    data: CollaboratorInvitationEmailDto,
  ): Promise<EmailResponseDto> {
    this.logger.log(`📧 Sending collaborator invitation to ${data.email}`);
    return this.resendService.sendCollaboratorInvitation(data);
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(): Promise<EmailResponseDto> {
    this.logger.log('📧 Testing email configuration');
    return this.resendService.sendTestEmail('test@example.com');
  }

  /**
   * Send test email
   */
  async sendTestEmail(to: string): Promise<EmailResponseDto> {
    this.logger.log(`📧 Sending test email to ${to}`);
    return this.resendService.sendTestEmail(to);
  }
}
