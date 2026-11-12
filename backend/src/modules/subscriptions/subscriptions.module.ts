import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { AdminPlansController, BusinessSubscriptionController, WebhooksController } from './subscriptions.controller.js';

@Module({
  controllers: [AdminPlansController, BusinessSubscriptionController, WebhooksController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}