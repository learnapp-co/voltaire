import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvitationDocument = Invitation & Document;

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true })
export class Invitation {
  @Prop({ type: Types.ObjectId, ref: 'Clip', required: true })
  clipId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId; // The user who sent the invitation

  @Prop({ required: true, lowercase: true, trim: true })
  invitedEmail: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedUser?: Types.ObjectId; // Set when user accepts or if user already exists

  @Prop({ enum: InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus;

  @Prop({ required: true })
  token: string; // Unique token for invitation verification

  @Prop({ required: true })
  expiresAt: Date; // Invitation expiration date

  @Prop()
  acceptedAt?: Date;

  @Prop()
  declinedAt?: Date;

  @Prop({ trim: true })
  message?: string; // Optional message from inviter

  // Mongoose adds these automatically with timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);

// Add indexes for better query performance
InvitationSchema.index({ clipId: 1, invitedEmail: 1 });
InvitationSchema.index({ token: 1 }, { unique: true });
InvitationSchema.index({ invitedEmail: 1, status: 1 });
InvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-cleanup expired invitations
