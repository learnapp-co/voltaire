import { Injectable, Logger } from '@nestjs/common';
import { BrevoService } from './services/brevo.service';
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

  constructor(private readonly brevoService: BrevoService) {
    this.logger.log('📧 EmailService initialized with Brevo API');
  }

  /**
   * Send a generic email
   */
  async sendEmail(data: SendEmailDto): Promise<EmailResponseDto> {
    return this.brevoService.sendTestEmail(data.to);
  }

  /**
   * Send welcome email with temporary password
   */
  async sendWelcomeEmail(data: WelcomeEmailDto): Promise<EmailResponseDto> {
    this.logger.log(`📧 Sending welcome email to ${data.email}`);
    return this.brevoService.sendWelcomeEmail(data);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    data: PasswordResetEmailDto,
  ): Promise<EmailResponseDto> {
    this.logger.log(`📧 Sending password reset email to ${data.email}`);
    return this.brevoService.sendPasswordResetEmail(data);
  }

  /**
   * Send collaborator invitation email
   */
  async sendCollaboratorInvitation(
    data: CollaboratorInvitationEmailDto,
  ): Promise<EmailResponseDto> {
    this.logger.log(`📧 Sending collaborator invitation to ${data.email}`);
    return this.brevoService.sendCollaboratorInvitation(data);
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(): Promise<EmailResponseDto> {
    this.logger.log('📧 Testing email configuration');
    return this.brevoService.sendTestEmail('test@example.com');
  }

  /**
   * Send test email
   */
  async sendTestEmail(to: string): Promise<EmailResponseDto> {
    this.logger.log(`📧 Sending test email to ${to}`);
    return this.brevoService.sendTestEmail(to);
  }
}
