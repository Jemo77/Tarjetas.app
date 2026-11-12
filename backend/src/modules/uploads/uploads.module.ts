import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service.js';
import { BusinessUploadsController, UploadsController } from './uploads.controller.js';

@Module({
  controllers: [BusinessUploadsController, UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}