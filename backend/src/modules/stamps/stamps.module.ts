import { Module } from '@nestjs/common';
import { StampPointsModule } from '../stamp-points/stamp-points.module.js';
import { StampsService } from './stamps.service.js';
import { BusinessStampsController, StampsController } from './stamps.controller.js';

@Module({
  imports: [StampPointsModule],
  controllers: [StampsController, BusinessStampsController],
  providers: [StampsService],
  exports: [StampsService],
})
export class StampsModule {}