import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { ClipsModule } from './clips/clips.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'your-secret-key',
        signOptions: {
          expiresIn: process.env.ACCESS_TOKEN_EXPIRE_MINUTES
            ? `${process.env.ACCESS_TOKEN_EXPIRE_MINUTES}m`
            : '525600m', // 1 year default
        },
      }),
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/clipflow',
    ),
    AuthModule,
    EmailModule,
    UsersModule,
    ClipsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
