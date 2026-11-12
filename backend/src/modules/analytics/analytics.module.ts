import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { AdminAnalyticsController, BusinessAnalyticsController } from './analytics.controller.js';

@Module({
  controllers: [BusinessAnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}