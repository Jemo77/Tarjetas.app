import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { EstablishmentsModule } from './modules/establishments/establishments.module.js';
import { MembersModule } from './modules/members/members.module.js';
import { CardTemplatesModule } from './modules/card-templates/card-templates.module.js';
import { StampPointsModule } from './modules/stamp-points/stamp-points.module.js';
import { StampsModule } from './modules/stamps/stamps.module.js';
import { CardsModule } from './modules/cards/cards.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    PrismaModule,
    MailModule,
    AuditModule,
    AuthModule,
    UsersModule,
    EstablishmentsModule,
    MembersModule,
    CardTemplatesModule,
    StampPointsModule,
    StampsModule,
    CardsModule,
    AnalyticsModule,
    SubscriptionsModule,
    UploadsModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}