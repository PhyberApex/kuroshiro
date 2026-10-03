import type { Response } from 'express'
import type { PluginDetail, PluginSummary } from 'kuroshiro-shared'
import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { diskStorage } from 'multer'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { ApplyRecipeUpdateDto } from './dto/apply-recipe-update.dto.js'
import { CreatePluginDto } from './dto/create-plugin.dto.js'
import { PreviewPluginDto } from './dto/preview-plugin.dto.js'
import { UpdatePluginDto } from './dto/update-plugin.dto.js'
import { PluginsService } from './plugins.service.js'
import { PluginAssignmentsService } from './services/plugin-assignments.service.js'
import { PluginExporterService } from './services/plugin-exporter.service.js'
import { ParsedPlugin, PluginImporterService } from './services/plugin-importer.service.js'
import { PluginReadsService } from './services/plugin-reads.service.js'
import { RecipeUpdateService } from './services/recipe-update.service.js'

@Controller('plugins')
export class PluginsController {
  constructor(
    private readonly pluginsService: PluginsService,
    private readonly pluginReads: PluginReadsService,
    private readonly assignments: PluginAssignmentsService,
    private readonly importerService: PluginImporterService,
    private readonly exporterService: PluginExporterService,
    private readonly recipeUpdateService: RecipeUpdateService,
  ) {}

  @Post('preview')
  async preview(@Body() previewData: PreviewPluginDto) {
    return this.pluginsService.preview(previewData)
  }

  @Get()
  async findAll(): Promise<PluginSummary[]> {
    return this.pluginReads.list()
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<PluginDetail> {
    return this.pluginReads.detail(id)
  }

  @Post()
  async create(@Body() createPluginDto: CreatePluginDto) {
    return this.pluginsService.create(createPluginDto)
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updatePluginDto: UpdatePluginDto): Promise<PluginDetail> {
    await this.pluginsService.update(id, updatePluginDto)
    return this.pluginReads.detail(id)
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string) {
    return this.pluginsService.duplicate(id)
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
  async remove(@Param('id') id: string) {
    const success = await this.pluginsService.remove(id)
    return { success }
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
    const createDto: CreatePluginDto = {
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
  async exportPlugin(@Param('id') id: string, @Res() res: Response) {
    const plugin = await this.pluginsService.findById(id)
    if (!plugin) {
      return res.status(404).json({ message: 'Plugin not found' })
    }

    const zipBuffer = await this.exporterService.exportToZip(plugin)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${plugin.name}.trmnlp.zip"`)
    res.send(zipBuffer)
  }
}
