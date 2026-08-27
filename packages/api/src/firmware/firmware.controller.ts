import type { FirmwareSyncResult } from 'kuroshiro-shared'
import { BadRequestException, Body, Controller, Delete, Get, Logger, Param, Post, ServiceUnavailableException, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { getErrorMessage } from '../utils/getErrorMessage'
import { Firmware } from './entities/firmware.entity'
import { FirmwareSyncService } from './firmware-sync.service'
import { FirmwareService, MAX_FIRMWARE_UPLOAD_BYTES } from './firmware.service'

@Controller('firmware')
export class FirmwareController {
  private readonly logger = new Logger(FirmwareController.name)

  constructor(
    private readonly firmwareService: FirmwareService,
    private readonly syncService: FirmwareSyncService,
  ) {}

  @Get()
  getAll(): Promise<Firmware[]> {
    return this.firmwareService.findAll()
  }

  @Post('sync')
  async sync(): Promise<FirmwareSyncResult> {
    try {
      return await this.syncService.sync()
    }
    catch (err) {
      const message = getErrorMessage(err)
      this.logger.error(`Firmware sync failed: ${message}`)
      throw new ServiceUnavailableException(`Could not sync firmware from TRMNL: ${message}`)
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FIRMWARE_UPLOAD_BYTES } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('version') version?: string,
    @Body('label') label?: string,
    @Body('compatibleModels') compatibleModels?: string,
  ): Promise<Firmware> {
    if (!file)
      throw new BadRequestException('No file uploaded')
    return this.firmwareService.upload(file, {
      version,
      label,
      compatibleModels: compatibleModels ? this.parseCompatibleModels(compatibleModels) : undefined,
    })
  }

  private parseCompatibleModels(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string'))
        throw new Error('not a string array')
      return parsed
    }
    catch {
      throw new BadRequestException('compatibleModels must be a JSON array of strings')
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.firmwareService.delete(id)
  }
}
