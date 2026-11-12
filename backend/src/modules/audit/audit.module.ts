import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AdminAuditController } from './admin-audit.controller.js';

@Global()
@Module({
  controllers: [AdminAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}