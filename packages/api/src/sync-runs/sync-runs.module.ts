import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SyncRun } from './entities/sync-run.entity.js'
import { SyncRunService } from './sync-run.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([SyncRun])],
  providers: [SyncRunService],
  exports: [SyncRunService],
})
export class SyncRunsModule {}
