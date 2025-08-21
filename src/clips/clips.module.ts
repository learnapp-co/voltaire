import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';
import { OpenAIService } from './services/openai.service';
import { FileUploadService } from './services/file-upload.service';
import { VideoProcessingService } from './services/video-processing.service';
import { Clip, ClipSchema } from '../schemas/clip.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Clip.name, schema: ClipSchema }]),
  ],
  controllers: [ClipsController],
  providers: [
    ClipsService,
    OpenAIService,
    FileUploadService,
    VideoProcessingService,
  ],
  exports: [
    ClipsService,
    OpenAIService,
    FileUploadService,
    VideoProcessingService,
  ],
})
export class ClipsModule {}
