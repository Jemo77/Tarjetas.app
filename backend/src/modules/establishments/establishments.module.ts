import { Module } from '@nestjs/common';
import { EstablishmentsService } from './establishments.service.js';
import { AdminEstablishmentsController } from './admin-establishments.controller.js';
import { BusinessEstablishmentsController } from './business-establishments.controller.js';

@Module({
  controllers: [AdminEstablishmentsController, BusinessEstablishmentsController],
  providers: [EstablishmentsService],
  exports: [EstablishmentsService],
})
export class EstablishmentsModule {}