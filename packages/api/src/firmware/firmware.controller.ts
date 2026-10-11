import type { FirmwareList, FirmwareRead, FirmwareSyncResult } from 'kuroshiro-shared'
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Logger, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { syncOr502 } from '../errors/sync-or-502.js'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { UploadFirmwareDto } from './dto/upload-firmware.dto.js'
import { FirmwareReadsService } from './firmware-reads.service.js'
import { FirmwareSyncService } from './firmware-sync.service.js'
import { FirmwareService } from './firmware.service.js'

@Controller('firmware')
export class FirmwareController {
  private readonly logger = new Logger(FirmwareController.name)

  constructor(
    private readonly firmwareService: FirmwareService,
    private readonly reads: FirmwareReadsService,
    private readonly syncService: FirmwareSyncService,
  ) {}

  @Get()
  getAll(): Promise<FirmwareList> {
    return this.reads.list()
  }

  @Post('sync')
  sync(): Promise<FirmwareSyncResult> {
    return syncOr502(this.logger, 'firmware', () => this.syncService.sync())
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
