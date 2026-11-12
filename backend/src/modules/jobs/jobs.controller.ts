import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';
import { JobsService, JobName } from './jobs.service.js';
import { GlobalRoles } from '../../common/decorators/roles.decorator.js';

@ApiTags('admin')
@GlobalRoles(GlobalRole.SUPER_ADMIN)
@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** Ejecuta un job a demanda (útil en dev; en prod van por BullMQ programado). */
  @Post(':name/run')
  @HttpCode(HttpStatus.OK)
  run(@Param('name') name: JobName) {
    return this.jobs.run(name);
  }
}