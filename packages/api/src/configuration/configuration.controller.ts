import type { Response } from 'express'
import type { ConfigurationImportSummary, ImportCheck } from 'kuroshiro-shared'
import { BadRequestException, Controller, Get, HttpCode, HttpStatus, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { ConfigurationExportService } from './services/configuration-export.service.js'
import { ConfigurationImportService } from './services/configuration-import.service.js'

function uploaded(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) {
    throw new BadRequestException('No file uploaded')
  }
  return file
}

@Controller('config')
export class ConfigurationController {
  constructor(
    private readonly exportService: ConfigurationExportService,
    private readonly importService: ConfigurationImportService,
  ) {}

  @Get('export')
  async exportConfiguration(@Query('redact') redact: string | undefined, @Res() res: Response): Promise<void> {
    const shouldRedact = redact === 'true'
    const zipBuffer = await this.exportService.exportToZip({ redact: shouldRedact })
    const filename = `kuroshiro-config-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    // The UI shows its own warning before triggering this download; this header is so a
    // script hitting the endpoint directly can't miss that the archive holds plaintext
    // credentials. Absent on a redacted archive, which has none.
    if (!shouldRedact) {
      res.setHeader('X-Kuroshiro-Contains-Secrets', 'true')
    }
    res.send(zipBuffer)
  }

  @Post('import')
  @UseInterceptors(LimitedFileInterceptor('file', UPLOAD_LIMITS.archiveUploadBytes))
  async importConfiguration(@UploadedFile() file?: Express.Multer.File): Promise<ConfigurationImportSummary> {
    return this.importService.importFromZip(uploaded(file).buffer)
  }

  /** Reads an archive and answers what importing it would do, without importing it. */
  @Post('import/check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(LimitedFileInterceptor('file', UPLOAD_LIMITS.archiveUploadBytes))
  async checkConfigurationImport(@UploadedFile() file?: Express.Multer.File): Promise<ImportCheck> {
    return this.importService.checkZip(uploaded(file).buffer)
  }
}
