import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ResendService } from './services/resend.service';

@Module({
  imports: [],
  providers: [EmailService, ResendService],
  exports: [EmailService, ResendService],
})
export class EmailModule {}
