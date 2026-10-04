import type { Response } from 'express'
import type { PluginDetail, PluginSummary, PreviewData } from 'kuroshiro-shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { diskStorage } from 'multer'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { attachmentDisposition } from '../utils/contentDisposition.js'
import { ApplyRecipeUpdateDto } from './dto/apply-recipe-update.dto.js'
import { CreatePluginDto } from './dto/create-plugin.dto.js'
import { PreviewDataDto } from './dto/preview-data.dto.js'
import { UpdatePluginDto } from './dto/update-plugin.dto.js'
import { WholePluginDto } from './dto/whole-plugin.dto.js'
import { PluginsService } from './plugins.service.js'
import { PluginAssignmentsService } from './services/plugin-assignments.service.js'
import { PluginExporterService } from './services/plugin-exporter.service.js'
import { ParsedPlugin, PluginImporterService } from './services/plugin-importer.service.js'
import { PluginPreviewDataService } from './services/plugin-preview-data.service.js'
import { PluginReadsService } from './services/plugin-reads.service.js'
import { RecipeUpdateService } from './services/recipe-update.service.js'

@Controller('plugins')
export class PluginsController {
  constructor(
    private readonly pluginsService: PluginsService,
    private readonly pluginReads: PluginReadsService,
    private readonly previewDataService: PluginPreviewDataService,
    private readonly assignments: PluginAssignmentsService,
    private readonly importerService: PluginImporterService,
    private readonly exporterService: PluginExporterService,
    private readonly recipeUpdateService: RecipeUpdateService,
  ) {}

  @Get()
  async findAll(): Promise<PluginSummary[]> {
    return this.pluginReads.list()
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<PluginDetail> {
    return this.pluginReads.detail(id)
  }

  @Post()
  async create(@Body() createPluginDto: CreatePluginDto): Promise<PluginDetail> {
    return this.pluginReads.detail(await this.pluginsService.build(createPluginDto))
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updatePluginDto: UpdatePluginDto): Promise<PluginDetail> {
    await this.pluginsService.update(id, updatePluginDto)
    return this.pluginReads.detail(id)
  }

  @Post(':id/preview-data')
  @HttpCode(HttpStatus.OK)
  async previewData(@Param('id') id: string, @Body() previewDataDto: PreviewDataDto): Promise<PreviewData> {
    return this.previewDataService.previewData(id, previewDataDto)
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string): Promise<PluginDetail> {
    const copy = await this.pluginsService.duplicate(id)
    return this.pluginReads.detail(copy.id)
  }

  @Get(':id/recipe-update')
  async checkRecipeUpdate(@Param('id') id: string) {
    return this.recipeUpdateService.checkForUpdate(id)
  }

  @Post(':id/recipe-update/apply')
  async applyRecipeUpdate(@Param('id') id: string, @Body() applyDto: ApplyRecipeUpdateDto) {
    return this.recipeUpdateService.applyUpdate(id, applyDto)
  }

  @Delete(':id/webhook-payload')
  async clearWebhookPayload(@Param('id') id: string) {
    return this.pluginsService.clearWebhookPayload(id)
  }

  @Post(':id/webhook-token')
  async regenerateWebhookToken(@Param('id') id: string) {
    return this.pluginsService.regenerateWebhookToken(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.pluginsService.remove(id)
  }

  @Post('import')
  @UseInterceptors(
    LimitedFileInterceptor('file', UPLOAD_LIMITS.pluginImportBytes, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
          cb(null, `${file.fieldname}-${uniqueSuffix}${file.originalname}`)
        },
      }),
    }),
  )
  async importPlugin(@UploadedFile() file: Express.Multer.File, @Body('deviceId') deviceId?: string) {
    if (!file) {
      throw new Error('No file uploaded')
    }

    const parsedPlugin = await this.importerService.importFromFile(file.path)
    return this.createPluginFromImport(parsedPlugin, deviceId)
  }

  @Post('import-github')
  async importFromGithub(@Body() body: { githubUrl: string, deviceId?: string }) {
    if (!body.githubUrl) {
      throw new Error('GitHub URL is required')
    }

    const parsedPlugin = await this.importerService.importFromGithubUrl(body.githubUrl)
    return this.createPluginFromImport(parsedPlugin, body.deviceId)
  }

  @Post('import-recipe')
  async importFromRecipe(@Body() body: { recipeId: string, deviceId?: string }) {
    if (!body.recipeId) {
      throw new Error('Recipe id or URL is required')
    }

    const parsedPlugin = await this.importerService.importFromRecipe(body.recipeId)
    return this.createPluginFromImport(parsedPlugin, body.deviceId)
  }

  private async createPluginFromImport(parsedPlugin: ParsedPlugin, deviceId?: string) {
    const createDto: WholePluginDto = {
      ...parsedPlugin,
      isActive: false,
      order: 1,
      // Only a Recipe import sets sourceRecipeId — File and GitHub imports never do.
      sourceRecipeSnapshot: parsedPlugin.sourceRecipeId ? { ...parsedPlugin } : undefined,
    }

    const plugin = await this.pluginsService.create(createDto)

    if (deviceId)
      await this.assignments.assign(plugin.id, deviceId)

    // Return plugin with security warning if transform.js exists
    return {
      ...plugin,
      _hasTransform: !!parsedPlugin.dataSources?.some(source => source.transformJs),
    }
  }

  @Get(':id/export')
  async exportPlugin(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const plugin = await this.pluginsService.requireWhole(id)
    const zipBuffer = await this.exporterService.exportToZip(plugin)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', attachmentDisposition(`${plugin.name}.trmnlp.zip`))
    res.send(zipBuffer)
  }
}
