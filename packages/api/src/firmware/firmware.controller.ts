import type { FirmwareCatchUp, FirmwareList, FirmwareRead, FirmwareSyncResult } from 'kuroshiro-shared'
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Logger, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { syncOr502 } from '../errors/sync-or-502.js'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { UploadFirmwareDto } from './dto/upload-firmware.dto.js'
import { FirmwareAutoUpdateService } from './firmware-auto-update.service.js'
import { FirmwareReadsService } from './firmware-reads.service.js'
import { FirmwareSyncService } from './firmware-sync.service.js'
import { toDeviceReference } from './firmware.mapper.js'
import { FirmwareService } from './firmware.service.js'

@Controller('firmware')
export class FirmwareController {
  private readonly logger = new Logger(FirmwareController.name)

  constructor(
    private readonly firmwareService: FirmwareService,
    private readonly reads: FirmwareReadsService,
    private readonly syncService: FirmwareSyncService,
    private readonly autoUpdateService: FirmwareAutoUpdateService,
  ) {}

  @Get()
  getAll(): Promise<FirmwareList> {
    return this.reads.list()
  }

  @Post('sync')
  sync(): Promise<FirmwareSyncResult> {
    return syncOr502(this.logger, 'firmware', () => this.syncService.sync())
  }

  @Get('catch-up')
  async previewCatchUp(): Promise<FirmwareCatchUp> {
    const { firmware, behind } = await this.autoUpdateService.previewCatchUp()
    return { version: firmware?.version ?? null, assigned: behind.map(toDeviceReference) }
  }

  @Post('catch-up')
  async catchUp(): Promise<FirmwareCatchUp> {
    const { firmware, assigned } = await this.autoUpdateService.catchUp()
    return { version: firmware?.version ?? null, assigned: assigned.map(toDeviceReference) }
  }

  @Post('upload')
  @UseInterceptors(LimitedFileInterceptor('file', UPLOAD_LIMITS.firmwareUploadBytes))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() input: UploadFirmwareDto): Promise<FirmwareRead> {
    if (!file)
      throw new BadRequestException('No file uploaded')
    const saved = await this.firmwareService.upload(file, input)
    return this.reads.readById(saved.id)
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.firmwareService.delete(id)
  }
}
