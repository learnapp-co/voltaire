import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { InvitationsController } from './controllers/invitations.controller';
import { TitleThumbnailController } from './controllers/title-thumbnail.controller';
import { S3UploadController } from './controllers/s3-upload.controller';
import { ClipProjectController } from './controllers/clip-project.controller';
import { CollaboratorController } from './controllers/collaborator.controller';
import { VotingController } from './controllers/voting.controller';
import { AIClipController } from './controllers/ai-clip.controller';
import { ClipsService } from './clips.service';
import { VideoProcessingService } from './services/video-processing.service';
import { S3UploadService } from './services/s3-upload.service';
import { CollaboratorService } from './services/collaborator.service';
import { VotingService } from './services/voting.service';
import { AITitleThumbnailService } from './services/ai-title-thumbnail.service';
import { TitleThumbnailService } from './services/title-thumbnail.service';
import { AIClipGenerationService } from './services/ai-clip-generation.service';
import { ClipProcessingService } from './services/clip-processing.service';
import { OpenAIService } from './services/openai.service';
import { GranularSrtProcessingService } from './services/granular-srt-processing.service';
import { Clip, ClipSchema } from '../schemas/clip.schema';
import {
  GeneratedClip,
  GeneratedClipSchema,
} from '../schemas/generated-clip.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Invitation, InvitationSchema } from '../schemas/invitation.schema';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    EmailModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Clip.name, schema: ClipSchema },
      { name: GeneratedClip.name, schema: GeneratedClipSchema },
      { name: User.name, schema: UserSchema },
      { name: Invitation.name, schema: InvitationSchema },
    ]),
  ],
  controllers: [
    InvitationsController,
    TitleThumbnailController,
    S3UploadController,
    ClipProjectController,
    CollaboratorController,
    VotingController,
    AIClipController,
  ],
  providers: [
    ClipsService,
    VideoProcessingService,
    S3UploadService,
    CollaboratorService,
    VotingService,
    AITitleThumbnailService,
    TitleThumbnailService,
    OpenAIService,
    AIClipGenerationService,
    ClipProcessingService,
    GranularSrtProcessingService,
  ],
  exports: [
    ClipsService,
    VideoProcessingService,
    S3UploadService,
    CollaboratorService,
    VotingService,
    AITitleThumbnailService,
    TitleThumbnailService,
    OpenAIService,
    AIClipGenerationService,
    ClipProcessingService,
    GranularSrtProcessingService,
  ],
})
export class ClipsModule {}
