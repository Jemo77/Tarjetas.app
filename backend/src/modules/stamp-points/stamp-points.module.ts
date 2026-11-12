import { Module } from '@nestjs/common';
import { StampPointsService } from './stamp-points.service.js';
import { PublicStampPointsController, RotatingTokenController, StampPointsController } from './stamp-points.controller.js';

@Module({
  controllers: [StampPointsController, RotatingTokenController, PublicStampPointsController],
  providers: [StampPointsService],
  exports: [StampPointsService],
})
export class StampPointsModule {}