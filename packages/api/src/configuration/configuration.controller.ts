import type { Response } from 'express'
import { BadRequestException, Controller, Get, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ConfigurationExportService } from './services/configuration-export.service.js'
import { ConfigurationImportService } from './services/configuration-import.service.js'

@Controller('config')
export class ConfigurationController {
  constructor(
    private readonly exportService: ConfigurationExportService,
    private readonly importService: ConfigurationImportService,
  ) {}

  @Get('export')
  async exportConfiguration(@Res() res: Response): Promise<void> {
    const zipBuffer = await this.exportService.exportToZip()
    const filename = `kuroshiro-config-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    // The UI shows its own static warning before triggering this download; this header
    // is so a script hitting the endpoint directly can't miss that the archive holds
    // plaintext credentials.
    res.setHeader('X-Kuroshiro-Contains-Secrets', 'true')
    res.send(zipBuffer)
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importConfiguration(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded')
    }
    return this.importService.importFromZip(file.buffer)
  }
}
