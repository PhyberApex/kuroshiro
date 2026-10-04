import type { Response } from 'express'
import type { PluginDetail, PluginImportOrigin, PluginImportResult, PluginSummary, PreviewData, RecipeUpdatePreview } from 'kuroshiro-shared'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { LimitedFileInterceptor } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { attachmentDisposition } from '../utils/contentDisposition.js'
import { ApplyRecipeUpdateDto } from './dto/apply-recipe-update.dto.js'
import { CreatePluginDto } from './dto/create-plugin.dto.js'
import { ImportGithubPluginDto, ImportRecipeDto } from './dto/import-plugin.dto.js'
import { PreviewDataDto } from './dto/preview-data.dto.js'
import { UpdatePluginDto } from './dto/update-plugin.dto.js'
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
  async checkRecipeUpdate(@Param('id') id: string): Promise<RecipeUpdatePreview> {
    return this.recipeUpdateService.checkForUpdate(id)
  }

  @Post(':id/recipe-update/apply')
  async applyRecipeUpdate(@Param('id') id: string, @Body() applyDto: ApplyRecipeUpdateDto): Promise<PluginDetail> {
    await this.recipeUpdateService.applyUpdate(id, applyDto)
    return this.pluginReads.detail(id)
  }

  @Delete(':id/webhook-payload')
  async clearWebhookPayload(@Param('id') id: string): Promise<PluginDetail> {
    await this.pluginsService.clearWebhookPayload(id)
    return this.pluginReads.detail(id)
  }

  @Post(':id/webhook-token')
  @HttpCode(HttpStatus.OK)
  async regenerateWebhookToken(@Param('id') id: string): Promise<PluginDetail> {
    await this.pluginsService.regenerateWebhookToken(id)
    return this.pluginReads.detail(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.pluginsService.remove(id)
  }

  @Post('import')
  @UseInterceptors(LimitedFileInterceptor('file', UPLOAD_LIMITS.pluginImportBytes))
  async importPlugin(@UploadedFile() file: Express.Multer.File | undefined, @Body('deviceId') deviceId?: string): Promise<PluginImportResult> {
    const { plugin, fileName } = this.importerService.importFromUpload(file)
    return this.answerImport(plugin, { type: 'file', fileName }, deviceId)
  }

  @Post('import-github')
  async importFromGithub(@Body() { githubUrl, deviceId }: ImportGithubPluginDto): Promise<PluginImportResult> {
    const { plugin, repository } = await this.importerService.importFromGithubUrl(githubUrl)
    return this.answerImport(plugin, { type: 'github', repository }, deviceId)
  }

  @Post('import-recipe')
  async importFromRecipe(@Body() { recipe, deviceId }: ImportRecipeDto): Promise<PluginImportResult> {
    const parsed = await this.importerService.importFromRecipe(recipe)
    return this.answerImport(parsed, { type: 'recipe', id: parsed.sourceRecipeId, name: parsed.name }, deviceId)
  }

  private async answerImport(parsed: ParsedPlugin, origin: PluginImportOrigin, deviceId?: string): Promise<PluginImportResult> {
    // Only a Recipe import keeps what it read as the Recipe Snapshot.
    const sourceRecipeSnapshot = parsed.sourceRecipeId ? { ...parsed } : undefined
    const id = await this.pluginsService.createOnDevice({ ...parsed, sourceRecipeSnapshot }, deviceId || undefined)
    return {
      plugin: await this.pluginReads.detail(id),
      origin,
      hasTransform: parsed.dataSources.some(source => Boolean(source.transformJs)),
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
