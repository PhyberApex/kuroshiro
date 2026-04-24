import { Body, Controller, Get, Logger, Post, UsePipes, ValidationPipe } from '@nestjs/common'
import { CleanupDto } from './dto/cleanup.dto'
import { CleanupResult, MaintenanceIssues, MaintenanceService } from './maintenance.service'

@Controller('maintenance')
export class MaintenanceController {
  private readonly logger = new Logger(MaintenanceController.name)

  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('scan')
  async scan(): Promise<MaintenanceIssues> {
    this.logger.log('Scan requested')
    return this.maintenanceService.scan()
  }

  @Post('cleanup')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
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
}
