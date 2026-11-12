import { Module } from '@nestjs/common';
import { CardTemplatesService } from './card-templates.service.js';
import { CardTemplatesController } from './card-templates.controller.js';

@Module({
  controllers: [CardTemplatesController],
  providers: [CardTemplatesService],
  exports: [CardTemplatesService],
})
export class CardTemplatesModule {}