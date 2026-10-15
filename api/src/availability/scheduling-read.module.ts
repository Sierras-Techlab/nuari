import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { SchedulingReadService } from './scheduling-read.service.js';

@Module({ imports: [DatabaseModule], providers: [SchedulingReadService], exports: [SchedulingReadService] })
export class SchedulingReadModule {}
