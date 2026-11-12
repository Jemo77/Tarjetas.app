import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { JobsService } from './jobs.service.js';
import { JobsController } from './jobs.controller.js';

/**
 * Tareas programadas. Cuando JOBS_ENABLED=true se podrían encolar con
 * BullMQ (@nestjs/bullmq); por defecto corren on-demand desde el admin.
 */
@Module({
  imports: [SubscriptionsModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}