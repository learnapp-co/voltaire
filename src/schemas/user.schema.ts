import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true })
  hashedPassword: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isAdmin: boolean;

  @Prop({ type: Date })
  resetTokenExpires?: Date;

  @Prop({ default: true })
  requiresPasswordChange: boolean;

  // Mongoose adds these automatically with timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
