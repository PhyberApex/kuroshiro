import type { CleanupResult, MaintenanceIssues, RetentionRunResult, RetentionStatus } from 'kuroshiro-shared'
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
  async scan(): Promise<MaintenanceIssues> {
    this.logger.log('Scan requested')
    return this.maintenanceService.scan()
  }

  @Post('cleanup')
  async cleanup(@Body() cleanupDto: CleanupDto): Promise<CleanupResult> {
    this.logger.log('Cleanup requested')
    return this.maintenanceService.cleanup(
      cleanupDto.orphanedFiles || [],
      cleanupDto.orphanedDirs || [],
      cleanupDto.brokenScreens || [],
      cleanupDto.tempFiles || [],
      cleanupDto.oldUploads || [],
      cleanupDto.dryRun || false,
    )
  }

  @Get('stats')
  async getStats(): Promise<{ fileCount: number, totalSize: number }> {
    this.logger.log('Stats requested')
    return this.maintenanceService.getStats()
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
