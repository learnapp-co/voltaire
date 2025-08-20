import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
  SendEmailDto,
  WelcomeEmailDto,
  PasswordResetEmailDto,
  EmailResponseDto,
} from './dto/email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send a generic email
   */
  async sendEmail(emailData: SendEmailDto): Promise<EmailResponseDto> {
    try {
      const result = await this.mailerService.sendMail({
        to: emailData.to,
        from: emailData.from,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        cc: emailData.cc,
        bcc: emailData.bcc,
      });

      this.logger.log(`Email sent successfully to ${emailData.to}`);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send email to ${emailData.to}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send welcome email with temporary password
   */
  async sendWelcomeEmail(data: WelcomeEmailDto): Promise<EmailResponseDto> {
    try {
      const result = await this.mailerService.sendMail({
        to: data.email,
        subject: 'Welcome to ClipFlow - Your Account Details',
        template: 'welcome',
        context: {
          firstName: data.firstName,
          temporaryPassword: data.temporaryPassword,
          frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        },
      });

      this.logger.log(`Welcome email sent to ${data.email}`);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(`Error sending welcome email to ${data.email}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    data: PasswordResetEmailDto,
  ): Promise<EmailResponseDto> {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl =
        data.resetUrl ||
        `${frontendUrl}/auth/login?reset-token=${data.resetToken}`;

      const result = await this.mailerService.sendMail({
        to: data.email,
        subject: 'ClipFlow - Password Reset Request',
        template: 'password-reset',
        context: {
          firstName: data.firstName,
          resetToken: data.resetToken,
          resetUrl: resetUrl,
          frontendUrl: frontendUrl,
        },
      });

      this.logger.log(`Password reset email sent to ${data.email}`);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(
        `Error sending password reset email to ${data.email}:`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(): Promise<EmailResponseDto> {
    try {
      // Test by sending a simple test email to a test address
      const result = await this.mailerService.sendMail({
        to: 'test@example.com',
        subject: 'ClipFlow - Configuration Test',
        text: 'Email configuration test successful',
      });

      this.logger.log('Email configuration test passed');
      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error('Email configuration test failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(to: string): Promise<EmailResponseDto> {
    try {
      const result = await this.mailerService.sendMail({
        to,
        subject: 'ClipFlow - Test Email',
        html: `
          <h2>Test Email from ClipFlow</h2>
          <p>This is a test email to verify the email configuration.</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        `,
        text: `
          Test Email from ClipFlow
          
          This is a test email to verify the email configuration.
          Sent at: ${new Date().toISOString()}
        `,
      });

      this.logger.log(`Test email sent to ${to}`);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send test email to ${to}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
