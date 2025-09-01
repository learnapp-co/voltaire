import { Injectable, Logger } from '@nestjs/common';
import * as brevo from '@getbrevo/brevo';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import {
  WelcomeEmailDto,
  PasswordResetEmailDto,
  CollaboratorInvitationEmailDto,
  EmailResponseDto,
} from '../dto/email.dto';

@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);
  private readonly apiInstance: brevo.TransactionalEmailsApi;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor() {
    const apiKey = process.env.BREVO_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || 'sahil.shukla@learnapp.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'ClipFlow';

    if (!apiKey) {
      this.logger.error('❌ BREVO_API_KEY not set!');
      throw new Error('Brevo API key is required');
    }

    // Initialize Brevo API client with API key
    this.apiInstance = new brevo.TransactionalEmailsApi();
    this.apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      apiKey,
    );

    this.logger.log('🚀 Brevo email service initialized');
    this.logger.log(`📧 From: ${this.fromName} <${this.fromEmail}>`);
  }

  /**
   * Compile email template with data
   */
  private compileTemplate(templateName: string, data: any): string {
    try {
      const templatePath = path.join(
        __dirname,
        '../templates',
        `${templateName}.hbs`,
      );
      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateContent);
      return template(data);
    } catch (error) {
      this.logger.error(`Failed to compile template ${templateName}:`, error);
      throw new Error(`Template compilation failed: ${error.message}`);
    }
  }

  /**
   * Send email using Brevo API
   */
  private async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<EmailResponseDto> {
    try {
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.sender = { name: this.fromName, email: this.fromEmail };
      sendSmtpEmail.to = [{ email: to }];

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      this.logger.log(`✅ Email sent successfully via Brevo!`);
      this.logger.log(`📧 Response: ${JSON.stringify(result.body)}`);

      // Extract message ID from response body
      const messageId = result.body?.messageId || 'brevo-success';

      return {
        success: true,
        messageId: messageId,
      };
    } catch (error) {
      this.logger.error('❌ Brevo email sending failed!');
      this.logger.error(`📧 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send password reset email using Brevo
   */
  async sendPasswordResetEmail(
    data: PasswordResetEmailDto,
  ): Promise<EmailResponseDto> {
    this.logger.log(`🔐 Sending password reset email to ${data.email}`);

    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl =
        data.resetUrl ||
        `${frontendUrl}/auth/login?reset-token=${data.resetToken}`;

      const html = this.compileTemplate('password-reset', {
        firstName: data.firstName,
        resetUrl,
        frontendUrl,
      });

      const result = await this.sendEmail(
        data.email,
        'ClipFlow - Password Reset Request',
        html,
      );

      if (result.success) {
        this.logger.log(`✅ Password reset email sent successfully via Brevo!`);
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Brevo password reset email failed!');
      this.logger.error(`🔐 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send welcome email using Brevo
   */
  async sendWelcomeEmail(data: WelcomeEmailDto): Promise<EmailResponseDto> {
    this.logger.log(`👋 Sending welcome email to ${data.email}`);

    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      const html = this.compileTemplate('welcome', {
        firstName: data.firstName,
        temporaryPassword: data.temporaryPassword,
        frontendUrl,
      });

      const result = await this.sendEmail(
        data.email,
        'Welcome to ClipFlow - Your Account Details',
        html,
      );

      if (result.success) {
        this.logger.log(`✅ Welcome email sent successfully via Brevo!`);
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Brevo welcome email failed!');
      this.logger.error(`👋 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send collaborator invitation using Brevo
   */
  async sendCollaboratorInvitation(
    data: CollaboratorInvitationEmailDto,
  ): Promise<EmailResponseDto> {
    this.logger.log(`🤝 Sending collaborator invitation to ${data.email}`);

    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const invitationUrl = `${frontendUrl}/invitations/accept?token=${data.invitationToken}`;

      const html = this.compileTemplate('collaborator-invitation', {
        inviterFirstName: data.inviterFirstName,
        inviterLastName: data.inviterLastName,
        inviterFullName: `${data.inviterFirstName} ${data.inviterLastName}`,
        projectTitle: data.projectTitle,
        message: data.message,
        needsSignup: data.needsSignup,
        invitationUrl,
        frontendUrl,
      });

      const result = await this.sendEmail(
        data.email,
        `You're invited to collaborate on "${data.projectTitle}" in ClipFlow`,
        html,
      );

      if (result.success) {
        this.logger.log(
          `✅ Collaborator invitation sent successfully via Brevo!`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Brevo collaborator invitation failed!');
      this.logger.error(`🤝 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send test email using Brevo
   */
  async sendTestEmail(email: string): Promise<EmailResponseDto> {
    this.logger.log(`🧪 Sending test email to ${email}`);

    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">✅ Email Service Test Successful!</h2>
          <p>This is a test email to verify that the Brevo email service is working correctly.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Service:</strong> Brevo API with Handlebars Templates</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>From:</strong> ${this.fromName} &lt;${this.fromEmail}&gt;</p>
          </div>
          <p style="color: #666; font-size: 12px;">
            This email was sent automatically by ClipFlow's email service.
          </p>
        </div>
      `;

      const result = await this.sendEmail(
        email,
        'ClipFlow - Email Service Test',
        html,
      );

      if (result.success) {
        this.logger.log(`✅ Test email sent successfully via Brevo!`);
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Brevo test email failed!');
      this.logger.error(`🧪 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }
}
