import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { BrevoService } from './services/brevo.service';

@Module({
  imports: [],
  providers: [EmailService, BrevoService],
  exports: [EmailService, BrevoService],
})
export class EmailModule {}
