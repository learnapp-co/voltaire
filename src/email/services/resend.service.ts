import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
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
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    if (!apiKey) {
      this.logger.error('❌ RESEND_API_KEY not set!');
      throw new Error('Resend API key is required');
    }

    this.resend = new Resend(apiKey);
    this.logger.log('🚀 Resend email service initialized');
    this.logger.log(`📧 From email: ${this.fromEmail}`);
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
   * Send password reset email using Resend
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

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.email,
        subject: 'ClipFlow - Password Reset Request',
        html,
      });

      this.logger.log(`✅ Password reset email sent successfully via Resend!`);
      this.logger.log(`🔐 Message ID: ${result.data?.id}`);

      return {
        success: true,
        messageId: result.data?.id || 'resend-success',
      };
    } catch (error) {
      this.logger.error('❌ Resend password reset email failed!');
      this.logger.error(`🔐 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send welcome email using Resend
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

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.email,
        subject: 'Welcome to ClipFlow - Your Account Details',
        html,
      });

      this.logger.log(`✅ Welcome email sent successfully via Resend!`);
      this.logger.log(`👋 Message ID: ${result.data?.id}`);

      return {
        success: true,
        messageId: result.data?.id || 'resend-success',
      };
    } catch (error) {
      this.logger.error('❌ Resend welcome email failed!');
      this.logger.error(`👋 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send collaborator invitation using Resend
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

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.email,
        subject: `You're invited to collaborate on "${data.projectTitle}" in ClipFlow`,
        html,
      });

      this.logger.log(
        `✅ Collaborator invitation sent successfully via Resend!`,
      );
      this.logger.log(`🤝 Message ID: ${result.data?.id}`);

      return {
        success: true,
        messageId: result.data?.id || 'resend-success',
      };
    } catch (error) {
      this.logger.error('❌ Resend collaborator invitation failed!');
      this.logger.error(`🤝 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send test email using Resend
   */
  async sendTestEmail(email: string): Promise<EmailResponseDto> {
    this.logger.log(`🧪 Sending test email to ${email}`);

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'ClipFlow - Email Service Test',
        html: `
          <h2>✅ Email Service Test Successful!</h2>
          <p>This is a test email to verify that the Resend email service is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Service:</strong> Resend API with Handlebars Templates</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        `,
      });

      this.logger.log(`✅ Test email sent successfully via Resend!`);
      this.logger.log(`🧪 Message ID: ${result.data?.id}`);

      return {
        success: true,
        messageId: result.data?.id || 'resend-success',
      };
    } catch (error) {
      this.logger.error('❌ Resend test email failed!');
      this.logger.error(`🧪 Error: ${error.message}`);

      return {
        success: false,
        error: error.message,
      };
    }
  }
}
