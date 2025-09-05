import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SlackNotificationData {
  clipTitle: string;
  projectName: string;
  pollType: 'title' | 'thumbnail';
  voteUrl: string;
  deadline?: Date;
  nonVoters?: string[];
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private slackWebhookUrl: string;
  private frontendUrl: string;

  constructor(private configService: ConfigService) {
    this.slackWebhookUrl =
      this.configService.get<string>('SLACK_WEBHOOK_URL') || '';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    if (!this.slackWebhookUrl) {
      this.logger.warn(
        'Slack webhook URL not configured. Slack notifications will be disabled.',
      );
    } else {
      this.logger.log('Slack notifications enabled');
    }
  }

  /**
   * Send new poll notification to Slack
   */
  async sendNewPollNotification(data: SlackNotificationData): Promise<void> {
    if (!this.slackWebhookUrl) {
      this.logger.warn('Slack webhook not configured, skipping notification');
      return;
    }

    const emoji = data.pollType === 'title' ? '🎬' : '🖼️';
    const pollTypeText =
      data.pollType === 'title' ? 'Title' : 'Thumbnail Header';

    const message = this.buildNewPollMessage(emoji, pollTypeText, data);

    try {
      await this.sendSlackMessage(message);
      this.logger.log(`Sent new ${data.pollType} poll notification to Slack`);
    } catch (error) {
      this.logger.error(
        `Failed to send new poll notification to Slack:`,
        error,
      );
    }
  }

  /**
   * Send reminder notification to Slack
   */
  async sendReminderNotification(data: SlackNotificationData): Promise<void> {
    if (!this.slackWebhookUrl) {
      this.logger.warn('Slack webhook not configured, skipping reminder');
      return;
    }

    const pollTypeText =
      data.pollType === 'title' ? 'Titles' : 'Thumbnail Headers';
    const nonVotersList = data.nonVoters?.join(', ') || 'Unknown members';

    const message = this.buildReminderMessage(
      pollTypeText,
      data,
      nonVotersList,
    );

    try {
      await this.sendSlackMessage(message);
      this.logger.log(
        `Sent reminder notification to Slack for ${data.pollType} poll`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send reminder notification to Slack:`,
        error,
      );
    }
  }

  /**
   * Build new poll notification message
   */
  private buildNewPollMessage(
    emoji: string,
    pollTypeText: string,
    data: SlackNotificationData,
  ): any {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} New ${pollTypeText} Poll is Live!`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `📝 *Clip:* ${data.clipTitle}`,
            },
            {
              type: 'mrkdwn',
              text: `📂 *Project:* ${data.projectName}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✨ ${
              data.pollType === 'title'
                ? 'Choose the best Title.'
                : 'Help us pick the right Thumbnail Header from the suggestions.'
            }`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `👉 <${data.voteUrl}|Click here> to cast your vote!`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '⏰ Please vote within the next 1 hour — your response is mandatory.',
            },
          ],
        },
      ],
    };
  }

  /**
   * Build reminder notification message
   */
  private buildReminderMessage(
    pollTypeText: string,
    data: SlackNotificationData,
    nonVotersList: string,
  ): any {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Reminder!',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🗳️ Voting on ${pollTypeText} for *${data.clipTitle}* under *${data.projectName}* is mandatory for all team members.`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚨 The following member(s) haven't responded yet: *${nonVotersList}*`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "🔔 If you don't vote, you'll keep getting a reminder every 30 mins in this channel until all votes are in.",
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `👉 <${data.voteUrl}|Click here> to cast your vote now ✅`,
          },
        },
      ],
    };
  }

  /**
   * Send message to Slack webhook
   */
  private async sendSlackMessage(message: any): Promise<void> {
    try {
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack API error: ${response.status} - ${errorText}`);
      }

      this.logger.debug('Slack message sent successfully');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send Slack message: ${error.message}`);
      } else {
        throw new Error('Failed to send Slack message: Unknown error');
      }
    }
  }

  /**
   * Test Slack integration
   */
  async testSlackIntegration(): Promise<{ success: boolean; message: string }> {
    if (!this.slackWebhookUrl) {
      return {
        success: false,
        message: 'Slack webhook URL not configured',
      };
    }

    const testMessage = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '🧪 *ClipFlow Slack Integration Test*\n\nThis is a test message to verify Slack integration is working correctly.',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Sent at: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    try {
      await this.sendSlackMessage(testMessage);
      return {
        success: true,
        message: 'Test message sent successfully to Slack',
      };
    } catch (error) {
      this.logger.error('Slack integration test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if Slack is configured
   */
  isConfigured(): boolean {
    return !!this.slackWebhookUrl;
  }

  /**
   * Generate vote URL for frontend
   */
  generateVoteUrl(
    clipId: string,
    clipDbId: string,
    pollType: 'title' | 'thumbnail',
  ): string {
    return `${this.frontendUrl}/clips/${clipId}/clips/${clipDbId}/vote/${pollType}`;
  }
}
