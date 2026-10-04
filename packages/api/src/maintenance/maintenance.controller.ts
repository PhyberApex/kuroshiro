import type { CleanupResult, RetentionRunResult, RetentionStatus, StorageCheck } from 'kuroshiro-shared'
import { Body, Controller, Get, Logger, Post } from '@nestjs/common'
import { CleanupDto } from './dto/cleanup.dto.js'
import { RetentionRunDto } from './dto/retention-run.dto.js'
import { MaintenanceService } from './maintenance.service.js'
import { RetentionService } from './retention.service.js'

@Controller('maintenance')
export class MaintenanceController {
  private readonly logger = new Logger(MaintenanceController.name)

  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly retentionService: RetentionService,
  ) {}

  @Get('scan')
  async scan(): Promise<StorageCheck> {
    this.logger.log('Stored-files check requested')
    return this.maintenanceService.scan()
  }

  @Post('cleanup')
  async cleanup(@Body() cleanupDto: CleanupDto): Promise<CleanupResult> {
    this.logger.log('Cleanup requested')
    return this.maintenanceService.cleanup(cleanupDto.findingIds)
  }

  @Get('retention')
  getRetentionStatus(): Promise<RetentionStatus> {
    this.logger.log('Retention status requested')
    return this.retentionService.getStatus()
  }

  @Post('retention/run')
  async runRetention(@Body() retentionRunDto: RetentionRunDto): Promise<RetentionRunResult> {
    this.logger.log('Retention run requested')
    return this.retentionService.run(retentionRunDto.dryRun || false)
  }
}
