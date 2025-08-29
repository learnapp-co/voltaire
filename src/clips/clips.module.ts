import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ClipsController } from './clips.controller';
import { InvitationsController } from './controllers/invitations.controller';
import { ClipsService } from './clips.service';
import { VideoProcessingService } from './services/video-processing.service';
import { S3UploadService } from './services/s3-upload.service';
import { CollaboratorService } from './services/collaborator.service';
import { VotingService } from './services/voting.service';
import { Clip, ClipSchema } from '../schemas/clip.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Invitation, InvitationSchema } from '../schemas/invitation.schema';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    MongooseModule.forFeature([
      { name: Clip.name, schema: ClipSchema },
      { name: User.name, schema: UserSchema },
      { name: Invitation.name, schema: InvitationSchema },
    ]),
  ],
  controllers: [ClipsController, InvitationsController],
  providers: [
    ClipsService,
    VideoProcessingService,
    S3UploadService,
    CollaboratorService,
    VotingService,
  ],
  exports: [
    ClipsService,
    VideoProcessingService,
    S3UploadService,
    CollaboratorService,
    VotingService,
  ],
})
export class ClipsModule {}
