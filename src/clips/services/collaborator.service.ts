import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { EmailService } from '../../email/email.service';
import {
  Invitation,
  InvitationDocument,
  InvitationStatus,
} from '../../schemas/invitation.schema';
import { Clip, ClipDocument, Collaborator } from '../../schemas/clip.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import {
  InviteCollaboratorDto,
  BulkInviteCollaboratorsDto,
  RespondToInvitationDto,
  ListCollaboratorsResponseDto,
  ListInvitationsResponseDto,
  RemoveCollaboratorDto,
  InvitationSuccessResponseDto,
  BulkInvitationResponseDto,
} from '../dto/collaborator.dto';

@Injectable()
export class CollaboratorService {
  private readonly logger = new Logger(CollaboratorService.name);

  constructor(
    @InjectModel(Invitation.name)
    private invitationModel: Model<InvitationDocument>,
    @InjectModel(Clip.name) private clipModel: Model<ClipDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private emailService: EmailService,
  ) {}

  /**
   * Invite a collaborator to a clip project
   */
  async inviteCollaborator(
    clipId: string,
    inviteDto: InviteCollaboratorDto,
    inviterId: string,
  ): Promise<InvitationSuccessResponseDto> {
    try {
      // Verify the clip exists and user is the owner
      const clip = await this.findClipByIdAndOwner(clipId, inviterId);

      // Check if email is already a collaborator
      const existingCollaborator = await this.isUserAlreadyCollaborator(
        clipId,
        inviteDto.email,
      );
      if (existingCollaborator) {
        throw new ConflictException(
          'User is already a collaborator on this project',
        );
      }

      // Check if there's already a pending invitation
      const existingInvitation = await this.invitationModel.findOne({
        clipId,
        invitedEmail: inviteDto.email.toLowerCase(),
        status: InvitationStatus.PENDING,
      });

      if (existingInvitation) {
        throw new ConflictException(
          'Invitation already sent to this email address',
        );
      }

      // Check if user exists
      const existingUser = await this.userModel.findOne({
        email: inviteDto.email.toLowerCase(),
      });

      // Get inviter details for email
      const inviter = await this.userModel.findById(inviterId);
      if (!inviter) {
        throw new NotFoundException('Inviter not found');
      }

      // Generate unique invitation token
      const token = this.generateInvitationToken();

      // Create invitation
      const invitation = new this.invitationModel({
        clipId,
        invitedBy: inviterId,
        invitedEmail: inviteDto.email.toLowerCase(),
        invitedUser: existingUser?._id,
        status: InvitationStatus.PENDING,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        message: inviteDto.message,
      });

      await invitation.save();

      // Send invitation email
      const emailResult = await this.emailService.sendCollaboratorInvitation({
        email: inviteDto.email,
        inviterFirstName: inviter.firstName,
        inviterLastName: inviter.lastName,
        projectTitle: clip.title,
        invitationToken: token,
        message: inviteDto.message,
        needsSignup: !existingUser,
      });

      if (!emailResult.success) {
        this.logger.error(
          `Failed to send invitation email to ${inviteDto.email}: ${emailResult.error}`,
        );
        // Don't fail the entire operation, just log the error
      }

      this.logger.log(
        `Invitation sent to ${inviteDto.email} for project ${clipId}`,
      );

      return {
        success: true,
        invitationId: invitation._id.toString(),
        email: inviteDto.email,
        message: 'Invitation sent successfully',
        newUserCreated: false,
      };
    } catch (error) {
      this.logger.error(
        `Error inviting collaborator to project ${clipId}:`,
        error,
      );

      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to send invitation');
    }
  }

  /**
   * Send bulk invitations
   */
  async bulkInviteCollaborators(
    clipId: string,
    bulkInviteDto: BulkInviteCollaboratorsDto,
    inviterId: string,
  ): Promise<BulkInvitationResponseDto> {
    const results: BulkInvitationResponseDto = {
      successful: [],
      failed: [],
      total: bulkInviteDto.emails.length,
      successCount: 0,
      failureCount: 0,
    };

    for (const email of bulkInviteDto.emails) {
      try {
        const result = await this.inviteCollaborator(
          clipId,
          { email, message: bulkInviteDto.message },
          inviterId,
        );

        results.successful.push(result);
        results.successCount++;
      } catch (error) {
        results.failed.push({
          email,
          error: error.message,
        });
        results.failureCount++;
      }
    }

    return results;
  }

  /**
   * Accept or decline an invitation
   */
  async respondToInvitation(
    token: string,
    respondDto: RespondToInvitationDto,
    userId?: string,
  ): Promise<{ success: boolean; message: string; clipId?: string }> {
    try {
      const invitation = await this.invitationModel
        .findOne({ token, status: InvitationStatus.PENDING })
        .populate('clipId');

      if (!invitation) {
        throw new NotFoundException(
          'Invitation not found or already processed',
        );
      }

      if (invitation.expiresAt < new Date()) {
        invitation.status = InvitationStatus.EXPIRED;
        await invitation.save();
        throw new BadRequestException('Invitation has expired');
      }

      const clip = invitation.clipId as any;
      if (!clip) {
        throw new NotFoundException('Associated clip project not found');
      }

      if (respondDto.response === 'accept') {
        // If no userId provided, this means user needs to sign up first
        if (!userId) {
          // Return success but indicate signup is needed
          return {
            success: true,
            message: 'Please complete signup to accept the invitation',
            clipId: clip._id.toString(),
          };
        }

        // Verify user email matches invitation
        const user = await this.userModel.findById(userId);
        if (!user || user.email.toLowerCase() !== invitation.invitedEmail) {
          throw new ForbiddenException('User email does not match invitation');
        }

        // Check if already a collaborator
        const isAlreadyCollaborator = clip.collaborators.some(
          (collab: Collaborator) => collab.userId.toString() === userId,
        );

        if (!isAlreadyCollaborator) {
          // Add as collaborator
          clip.collaborators.push({
            userId: userId,
            addedAt: new Date(),
            addedBy: invitation.invitedBy,
          });
          await clip.save();
        }

        // Update invitation
        invitation.status = InvitationStatus.ACCEPTED;
        invitation.invitedUser = new Types.ObjectId(userId);
        invitation.acceptedAt = new Date();
        await invitation.save();

        this.logger.log(
          `User ${userId} accepted invitation for project ${clip._id}`,
        );

        return {
          success: true,
          message: 'Invitation accepted successfully',
          clipId: clip._id.toString(),
        };
      } else {
        // Decline invitation
        invitation.status = InvitationStatus.DECLINED;
        invitation.declinedAt = new Date();
        await invitation.save();

        this.logger.log(`Invitation declined for project ${clip._id}`);

        return {
          success: true,
          message: 'Invitation declined',
          clipId: clip._id.toString(),
        };
      }
    } catch (error) {
      this.logger.error(`Error responding to invitation ${token}:`, error);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to process invitation response',
      );
    }
  }

  /**
   * Get all collaborators for a project
   */
  async getCollaborators(
    clipId: string,
    userId: string,
  ): Promise<ListCollaboratorsResponseDto> {
    try {
      // Verify user has access to this project
      await this.verifyUserAccess(clipId, userId);

      const clip = await this.clipModel
        .findById(clipId)
        .populate('userId', 'email firstName lastName')
        .populate('collaborators.userId', 'email firstName lastName')
        .populate('collaborators.addedBy', 'email firstName lastName');

      if (!clip) {
        throw new NotFoundException('Clip project not found');
      }

      const owner = clip.userId as any;
      const collaborators = clip.collaborators.map((collab: any) => ({
        userId: collab.userId._id.toString(),
        email: collab.userId.email,
        firstName: collab.userId.firstName,
        lastName: collab.userId.lastName,
        addedAt: collab.addedAt,
        addedBy: collab.addedBy._id.toString(),
      }));

      return {
        collaborators,
        owner: {
          userId: owner._id.toString(),
          email: owner.email,
          firstName: owner.firstName,
          lastName: owner.lastName,
        },
        total: collaborators.length,
      };
    } catch (error) {
      this.logger.error(
        `Error getting collaborators for project ${clipId}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to get collaborators');
    }
  }

  /**
   * Get invitations for a project
   */
  async getInvitations(
    clipId: string,
    userId: string,
  ): Promise<ListInvitationsResponseDto> {
    try {
      // Verify user is the owner
      await this.findClipByIdAndOwner(clipId, userId);

      const invitations = await this.invitationModel
        .find({ clipId })
        .populate('clipId', 'title')
        .populate('invitedBy', 'email firstName lastName')
        .sort({ createdAt: -1 });

      const invitationResponses = invitations.map((inv: any) => ({
        id: inv._id.toString(),
        clipId: inv.clipId._id.toString(),
        clipTitle: inv.clipId.title,
        invitedEmail: inv.invitedEmail,
        invitedBy: {
          userId: inv.invitedBy._id.toString(),
          email: inv.invitedBy.email,
          firstName: inv.invitedBy.firstName,
          lastName: inv.invitedBy.lastName,
        },
        status: inv.status,
        message: inv.message,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        declinedAt: inv.declinedAt,
      }));

      return {
        invitations: invitationResponses,
        total: invitations.length,
      };
    } catch (error) {
      this.logger.error(
        `Error getting invitations for project ${clipId}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to get invitations');
    }
  }

  /**
   * Remove a collaborator from a project
   */
  async removeCollaborator(
    clipId: string,
    removeDto: RemoveCollaboratorDto,
    requesterId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Verify requester is the owner
      const clip = await this.findClipByIdAndOwner(clipId, requesterId);

      // Find and remove the collaborator
      const collaboratorIndex = clip.collaborators.findIndex(
        (collab: Collaborator) => collab.userId.toString() === removeDto.userId,
      );

      if (collaboratorIndex === -1) {
        throw new NotFoundException('Collaborator not found in this project');
      }

      clip.collaborators.splice(collaboratorIndex, 1);
      await clip.save();

      this.logger.log(
        `Collaborator ${removeDto.userId} removed from project ${clipId}`,
      );

      return {
        success: true,
        message: 'Collaborator removed successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error removing collaborator from project ${clipId}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to remove collaborator');
    }
  }

  /**
   * Check if user has access to a project (owner or collaborator)
   */
  async verifyUserAccess(clipId: string, userId: string): Promise<boolean> {
    const clip = await this.clipModel.findById(clipId);

    if (!clip) {
      throw new NotFoundException('Clip project not found');
    }

    // Check if user is owner
    if (clip.userId.toString() === userId) {
      return true;
    }

    // Check if user is collaborator
    const isCollaborator = clip.collaborators.some(
      (collab: Collaborator) => collab.userId.toString() === userId,
    );

    if (!isCollaborator) {
      throw new ForbiddenException(
        'Access denied: You are not a collaborator on this project',
      );
    }

    return true;
  }

  /**
   * Check if user is owner of a project
   */
  async verifyUserIsOwner(clipId: string, userId: string): Promise<boolean> {
    const clip = await this.clipModel.findById(clipId);

    if (!clip) {
      throw new NotFoundException('Clip project not found');
    }

    if (clip.userId.toString() !== userId) {
      throw new ForbiddenException(
        'Access denied: Only project owner can perform this action',
      );
    }

    return true;
  }

  /**
   * Helper methods
   */
  private async findClipByIdAndOwner(
    clipId: string,
    ownerId: string,
  ): Promise<ClipDocument> {
    const clip = await this.clipModel.findOne({ _id: clipId, userId: ownerId });

    if (!clip) {
      throw new NotFoundException('Clip project not found or access denied');
    }

    return clip;
  }

  private async isUserAlreadyCollaborator(
    clipId: string,
    email: string,
  ): Promise<boolean> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) return false;

    const clip = await this.clipModel.findById(clipId);
    if (!clip) return false;

    return clip.collaborators.some(
      (collab: Collaborator) =>
        collab.userId.toString() === user._id.toString(),
    );
  }

  private generateInvitationToken(): string {
    return `inv_${crypto.randomBytes(32).toString('hex')}`;
  }
}
