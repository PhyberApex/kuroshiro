import type { FindOptionsRelations } from 'typeorm'
import type { MashupSlot } from '../mashup/entities/mashup-slot.entity.js'
import type { CreatePluginDto } from './dto/create-plugin.dto.js'
import type { PluginDataSourceDto } from './dto/plugin-data-source.dto.js'
import type { PluginFieldDto } from './dto/plugin-field.dto.js'
import type { PluginTemplateDto } from './dto/plugin-template.dto.js'
import type { PreviewPluginDto } from './dto/preview-plugin.dto.js'
import type { UpdatePluginDto } from './dto/update-plugin.dto.js'
import type { MergeStrategy, PluginKind } from './entities/plugin.entity.js'
import type { PluginKindFields } from './plugin-kind-fields.js'
import type { PluginWithFieldValues } from './services/plugin-field-values.service.js'
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Screen } from '../screens/screens.entity.js'
import generateApikey from '../utils/generateApikey.js'
import { PluginDataSource } from './entities/plugin-data-source.entity.js'
import { PluginField } from './entities/plugin-field.entity.js'
import { PluginTemplate } from './entities/plugin-template.entity.js'
import { Plugin } from './entities/plugin.entity.js'
import { dataSourceModeViolation } from './plugin-data-source-mode.js'
import { pluginKindFieldViolation } from './plugin-kind-fields.js'
import { PluginDataResolverService } from './services/plugin-data-resolver.service.js'
import { PluginFieldValuesService } from './services/plugin-field-values.service.js'
import { PluginRefreshService } from './services/plugin-refresh.service.js'
import { PluginRenderCacheService } from './services/plugin-render-cache.service.js'
import { PluginRendererService } from './services/plugin-renderer.service.js'
import { PluginSchedulerService } from './services/plugin-scheduler.service.js'
import { PluginTemplateContextService } from './services/plugin-template-context.service.js'

type UpdateBasicFields = Omit<UpdatePluginDto, 'dataSources' | 'templates' | 'fields' | 'fieldValues' | 'webhookToken'>

interface MergeFields {
  mergeStrategy: MergeStrategy | null | undefined
  streamLimit: number | null | undefined
}

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly logger = new Logger(PluginsService.name)

  private mashupSlotRepository: Repository<MashupSlot>

  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    @InjectRepository(PluginDataSource)
    private readonly dataSourceRepository: Repository<PluginDataSource>,
    @InjectRepository(PluginTemplate)
    private readonly templateRepository: Repository<PluginTemplate>,
    @InjectRepository(PluginField)
    private readonly fieldRepository: Repository<PluginField>,
    private readonly pluginDataResolver: PluginDataResolverService,
    private readonly renderer: PluginRendererService,
    private readonly scheduler: PluginSchedulerService,
    private readonly renderCache: PluginRenderCacheService,
    private readonly fieldValues: PluginFieldValuesService,
    private readonly pluginRefresh: PluginRefreshService,
    private readonly templateContext: PluginTemplateContextService,
  ) {
    // Lazy injection to avoid circular dependency with MashupModule
    setTimeout(() => {
      try {
        this.mashupSlotRepository = this.pluginRepository.manager.getRepository('MashupSlot')
      }
      catch {
        // MashupSlot might not be registered yet during tests or initialization
        this.logger.debug('MashupSlot repository not available')
      }
    }, 0)
  }

  async onModuleInit() {
    this.logger.log('Initializing plugin scheduler...')
    const plugins = await this.pluginRepository.find({
      relations: { dataSources: true, templates: true },
    })

    for (const plugin of plugins) {
      if (plugin.kind === 'Webhook') {
        continue
      }
      if (plugin.dataSources && plugin.dataSources.length > 0 && plugin.templates && plugin.templates.length > 0) {
        this.scheduler.schedulePlugin(plugin)
        this.logger.log(`Scheduled plugin: ${plugin.name}`)
      }
    }
  }

  async findAll(): Promise<PluginWithFieldValues[]> {
    const plugins = await this.pluginRepository.find({
      relations: { dataSources: true, templates: true, fields: true, deviceAssignments: { device: true } },
      order: { name: 'ASC' },
    })
    return this.fieldValues.attach(plugins)
  }

  async findById(id: string): Promise<PluginWithFieldValues | null> {
    const plugin = await this.pluginRepository.findOne({
      where: { id },
      relations: { dataSources: true, templates: true, fields: true, deviceAssignments: { device: true } },
    })
    return plugin && this.withFieldValues(plugin)
  }

  private async withFieldValues(plugin: Plugin): Promise<PluginWithFieldValues> {
    const [withValues] = await this.fieldValues.attach([plugin])
    return withValues
  }

  async create(pluginData: CreatePluginDto): Promise<PluginWithFieldValues> {
    const { dataSources, templates, fields, fieldValues, ...basicFields } = pluginData

    this.logger.debug(`Creating plugin with data: ${JSON.stringify({ dataSources, templates, fields, basicFields })}`)

    this.validateNewChildren(dataSources, fields)
    this.fieldValues.assertWritable(fields, fieldValues)

    const kind = basicFields.kind || 'Poll'

    this.assertKindFields({
      kind,
      dataSources,
      webhookToken: basicFields.webhookToken,
      mergeStrategy: basicFields.mergeStrategy,
      streamLimit: basicFields.streamLimit,
    })

    const savedPlugin = await this.pluginRepository.save(this.buildPluginToSave(basicFields, kind))
    this.logger.debug(`Saved plugin: ${savedPlugin.id}`)

    await this.createDataSources(savedPlugin, dataSources)
    await this.createTemplates(savedPlugin, templates)
    await this.createFields(savedPlugin, fields)

    const created = await this.reloadPlugin(savedPlugin.id)
    await this.fieldValues.write(created, fieldValues)
    this.scheduleIfReady(created, `Scheduled new plugin: ${created.name}`)

    return this.withFieldValues(created)
  }

  async duplicate(id: string): Promise<PluginWithFieldValues> {
    const source = await this.findPluginWithRelations(id, { dataSources: true, templates: true, fields: true })
    if (!source) {
      throw new NotFoundException(`Plugin ${id} not found`)
    }

    return this.create({
      ...this.buildDuplicateDto(source),
      fieldValues: await this.fieldValues.storedFor(id),
    })
  }

  private buildDuplicateDto(source: Plugin): CreatePluginDto {
    return {
      name: `${source.name} (copy)`,
      description: source.description ?? undefined,
      kind: source.kind,
      refreshInterval: source.refreshInterval,
      mergeStrategy: source.mergeStrategy ?? undefined,
      streamLimit: source.streamLimit ?? undefined,
      sourceRecipeId: source.sourceRecipeId,
      sourceRecipeSnapshot: source.sourceRecipeSnapshot,
      dataSources: (source.dataSources || []).map(ds => ({
        name: ds.name,
        mode: ds.mode,
        method: ds.method,
        url: ds.url ?? undefined,
        headers: ds.headers,
        body: ds.body,
        transformJs: ds.transformJs,
        literalValue: ds.literalValue,
        order: ds.order,
      })),
      templates: (source.templates || []).map(t => ({
        layout: t.layout,
        liquidMarkup: t.liquidMarkup,
      })),
      fields: (source.fields || []).map(f => ({
        keyname: f.keyname,
        fieldType: f.fieldType,
        name: f.name,
        description: f.description ?? undefined,
        defaultValue: f.defaultValue ?? undefined,
        options: f.options,
        required: f.required,
        order: f.order,
      })),
    }
  }

  private validateNewChildren(dataSources: PluginDataSourceDto[] | undefined, fields: PluginFieldDto[] | undefined): void {
    if (dataSources && Array.isArray(dataSources) && dataSources.length > 0) {
      this.validateDataSourceNames(dataSources, fields || [])
      this.assertDataSourceModeFields(dataSources)
    }
  }

  private buildPluginToSave(basicFields: Omit<CreatePluginDto, 'dataSources' | 'templates' | 'fields'>, kind: PluginKind) {
    return {
      name: basicFields.name,
      description: basicFields.description,
      kind,
      refreshInterval: basicFields.refreshInterval || 15,
      sourceRecipeId: basicFields.sourceRecipeId,
      sourceRecipeSnapshot: basicFields.sourceRecipeSnapshot,
      ...(kind === 'Webhook'
        ? {
            webhookToken: generateApikey(),
            mergeStrategy: basicFields.mergeStrategy,
            streamLimit: basicFields.streamLimit ?? null,
          }
        : {}),
    }
  }

  private async createDataSources(plugin: Plugin, dataSources: PluginDataSourceDto[] | undefined): Promise<void> {
    if (!dataSources || !Array.isArray(dataSources) || dataSources.length === 0)
      return

    this.logger.debug(`Creating ${dataSources.length} data sources`)
    await this.persistDataSources(plugin, dataSources)
  }

  private async createTemplates(plugin: Plugin, templates: PluginTemplateDto[] | undefined): Promise<void> {
    if (!templates || !Array.isArray(templates) || templates.length === 0)
      return

    this.logger.debug(`Creating ${templates.length} templates`)
    for (const templateData of templates) {
      const newTemplate = this.templateRepository.create({
        layout: templateData.layout || 'full',
        liquidMarkup: templateData.liquidMarkup,
        plugin,
      })
      await this.templateRepository.save(newTemplate)
      this.logger.debug(`Saved template`)
    }
  }

  private async createFields(plugin: Plugin, fields: PluginFieldDto[] | undefined): Promise<void> {
    if (!fields || !Array.isArray(fields) || fields.length === 0)
      return

    this.logger.debug(`Creating ${fields.length} fields`)
    await this.persistFields(plugin, fields)
  }

  private buildFieldFields(fieldData: PluginFieldDto) {
    return {
      keyname: fieldData.keyname,
      fieldType: fieldData.fieldType || 'string',
      name: fieldData.name,
      description: fieldData.description ?? null,
      defaultValue: fieldData.defaultValue ?? null,
      options: fieldData.options ?? null,
      required: fieldData.required || false,
      order: fieldData.order || 0,
    }
  }

  // An existing Plugin Field of the same keyname is updated in place, so it
  // keeps its id and with it its Field Value (ADR-0032).
  private async persistFields(plugin: Plugin, fields: PluginFieldDto[], existingFields: PluginField[] = []): Promise<PluginField[]> {
    const saved: PluginField[] = []
    for (const fieldData of fields) {
      const existing = existingFields.find(field => field.keyname === fieldData.keyname)
      const field = existing
        ? Object.assign(existing, this.buildFieldFields(fieldData))
        : this.fieldRepository.create({ ...this.buildFieldFields(fieldData), plugin })
      saved.push(await this.fieldRepository.save(field))
      this.logger.debug(`Saved field: ${field.keyname}`)
    }
    return saved
  }

  private async findPluginWithRelations(id: string, relations: FindOptionsRelations<Plugin>): Promise<Plugin | null> {
    return this.pluginRepository.findOne({ where: { id }, relations })
  }

  private async reloadPlugin(id: string): Promise<Plugin> {
    const plugin = await this.findPluginWithRelations(id, { dataSources: true, templates: true, fields: true })

    if (!plugin)
      throw new Error(`Failed to load newly created plugin: ${id}`)

    return plugin
  }

  private isSchedulable(plugin: Plugin): boolean {
    return !!(plugin.dataSources && plugin.dataSources.length > 0 && plugin.templates && plugin.templates.length > 0)
  }

  private isRenderable(plugin: Plugin): boolean {
    return plugin.kind === 'Webhook' ? !!plugin.templates?.length : this.isSchedulable(plugin)
  }

  private scheduleIfReady(plugin: Plugin, message: string): void {
    if (this.isSchedulable(plugin)) {
      this.scheduler.schedulePlugin(plugin)
      this.logger.log(message)
    }
  }

  async update(id: string, pluginData: UpdatePluginDto): Promise<PluginWithFieldValues | null> {
    const plugin = await this.pluginRepository.findOne({
      where: { id },
      relations: { dataSources: true, templates: true, fields: true },
    })
    if (!plugin)
      return null

    const { dataSources, templates, fields, fieldValues, webhookToken, ...rawBasicFields } = pluginData
    const basicFields = this.dropUnsetFields(rawBasicFields)

    this.assertKindUnchanged(basicFields, plugin)
    this.validateUpdatedChildren(plugin, dataSources, fields)
    this.fieldValues.assertWritable(fields ?? plugin.fields, fieldValues)

    const mergeFields = this.resolveMergeFields(basicFields, plugin)

    this.assertKindFields({
      kind: plugin.kind,
      dataSources: dataSources ?? plugin.dataSources,
      webhookToken: webhookToken === plugin.webhookToken ? undefined : webhookToken,
      mergeStrategy: mergeFields.mergeStrategy,
      streamLimit: mergeFields.streamLimit,
    })

    this.applyBasicFields(plugin, basicFields, mergeFields)

    if (dataSources !== undefined) {
      await this.replaceDataSources(plugin, dataSources)
    }
    await this.replaceTemplates(plugin, templates)
    await this.replaceFields(plugin, fields)

    const updated = await this.pluginRepository.save(plugin)
    const fieldValuesChanged = await this.fieldValues.write(updated, fieldValues)

    await this.refreshRendersAfterUpdate(id, {
      reschedule: dataSources !== undefined || !!templates,
      rerender: fieldValuesChanged || Array.isArray(fields),
    })

    return this.withFieldValues(updated)
  }

  private async refreshRendersAfterUpdate(id: string, { reschedule, rerender }: { reschedule: boolean, rerender: boolean }): Promise<void> {
    await this.invalidateRenderCaches(id)

    if (reschedule) {
      await this.rescheduleAfterUpdate(id)
    }

    if (rerender) {
      await this.refreshNow(id)
    }
  }

  // A changed Field Value (or default) changes what is fetched and rendered,
  // so the cache is rebuilt at once rather than at the next scheduler tick.
  // The caches were invalidated before this runs, so a failure here leaves
  // the next poll to render on demand.
  private async refreshNow(id: string): Promise<void> {
    const plugin = await this.findPluginWithRelations(id, { dataSources: true, templates: true })
    if (!plugin || !this.isRenderable(plugin))
      return

    try {
      await this.pluginRefresh.refresh(plugin)
    }
    catch (error) {
      this.logger.error(`Failed to refresh plugin ${id} after its Field Values changed`, error)
    }
  }

  // class-transformer's plainToInstance (the real ValidationPipe path) gives every declared
  // UpdatePluginDto field an own property equal to `undefined` even when the caller never sent
  // it, so unset fields must be dropped here before they reach the Object.assign in
  // applyBasicFields — otherwise a partial PATCH would blank out every field the caller omitted.
  private dropUnsetFields(rawFields: UpdateBasicFields): UpdateBasicFields {
    return Object.fromEntries(
      Object.entries(rawFields).filter(([, value]) => value !== undefined),
    ) as UpdateBasicFields
  }

  private assertKindUnchanged(basicFields: UpdateBasicFields, plugin: Plugin): void {
    if (basicFields.kind !== undefined && basicFields.kind !== plugin.kind) {
      throw new BadRequestException(`A Plugin's Kind is fixed at creation and cannot be changed`)
    }
  }

  private validateUpdatedChildren(plugin: Plugin, dataSources: PluginDataSourceDto[] | undefined, fields: PluginFieldDto[] | undefined): void {
    if (dataSources !== undefined || fields !== undefined) {
      const finalDataSources = dataSources !== undefined ? dataSources : (plugin.dataSources || [])
      const finalFields = fields !== undefined ? fields : (plugin.fields || [])
      this.validateDataSourceNames(finalDataSources, finalFields)
    }

    if (dataSources !== undefined && Array.isArray(dataSources) && dataSources.length > 0) {
      this.assertDataSourceModeFields(dataSources)
    }
  }

  private resolveMergeFields(basicFields: UpdateBasicFields, plugin: Plugin): MergeFields {
    const mergeStrategy = basicFields.mergeStrategy !== undefined ? basicFields.mergeStrategy : plugin.mergeStrategy
    const streamLimit = mergeStrategy === 'stream' ? basicFields.streamLimit ?? plugin.streamLimit : basicFields.streamLimit
    return { mergeStrategy, streamLimit }
  }

  private applyBasicFields(plugin: Plugin, basicFields: UpdateBasicFields, mergeFields: MergeFields): void {
    Object.assign(plugin, basicFields, plugin.kind === 'Webhook' ? { mergeStrategy: mergeFields.mergeStrategy, streamLimit: mergeFields.streamLimit ?? null } : {})
  }

  private async replaceDataSources(plugin: Plugin, dataSources: PluginDataSourceDto[]): Promise<void> {
    if (plugin.dataSources && plugin.dataSources.length > 0) {
      await this.dataSourceRepository.remove(plugin.dataSources)
    }
    plugin.dataSources = Array.isArray(dataSources) && dataSources.length > 0
      ? await this.persistDataSources(plugin, dataSources)
      : []
  }

  private async persistDataSources(plugin: Plugin, dataSources: PluginDataSourceDto[]): Promise<PluginDataSource[]> {
    const saved: PluginDataSource[] = []
    for (const [index, sourceData] of dataSources.entries()) {
      const newDataSource = this.dataSourceRepository.create({
        ...this.buildDataSourceFields(sourceData, index),
        plugin,
      })
      saved.push(await this.dataSourceRepository.save(newDataSource))
      this.logger.debug(`Saved data source: ${newDataSource.name}`)
    }
    return saved
  }

  private async replaceTemplates(plugin: Plugin, templates: PluginTemplateDto[] | undefined): Promise<void> {
    if (!templates || !Array.isArray(templates) || templates.length === 0)
      return

    if (plugin.templates && plugin.templates.length > 0) {
      Object.assign(plugin.templates[0], templates[0])
      await this.templateRepository.save(plugin.templates[0])
    }
    else {
      const newTemplate = this.templateRepository.create({
        ...templates[0],
        plugin,
      })
      await this.templateRepository.save(newTemplate)
    }
  }

  private async replaceFields(plugin: Plugin, fields: PluginFieldDto[] | undefined): Promise<void> {
    if (!fields || !Array.isArray(fields))
      return

    const existingFields = plugin.fields ?? []
    const removed = existingFields.filter(existing => !fields.some(field => field.keyname === existing.keyname))
    if (removed.length > 0) {
      await this.fieldRepository.remove(removed)
    }

    this.logger.debug(`Updating ${fields.length} fields`)
    // Reassigned so the Plugin save that follows sees exactly the rows that
    // exist: a row missing from a loaded relation array is detached by TypeORM.
    plugin.fields = await this.persistFields(plugin, fields, existingFields)
  }

  // Public: also called directly by RecipeUpdateService, whose Recipe Update
  // apply mutates data sources/templates/fields itself (ADR-0030's whole-item
  // apply semantics don't fit this method's wipe-and-recreate `update()` path)
  // but still needs the same cache invalidation and rescheduling afterward.
  async invalidateRenderCaches(pluginId: string): Promise<void> {
    await this.screenRepository.update({ plugin: { id: pluginId } }, { cachedPluginOutput: null })
    await this.renderCache.invalidateMashupCaches(pluginId)
  }

  async rescheduleAfterUpdate(id: string): Promise<void> {
    this.scheduler.removeScheduledJob(id)
    const fullPlugin = await this.findPluginWithRelations(id, { dataSources: true, templates: true })
    if (fullPlugin) {
      this.scheduleIfReady(fullPlugin, `Rescheduled plugin: ${fullPlugin.name}`)
    }
  }

  private assertDataSourceModeFields(dataSources: PluginDataSourceDto[]): void {
    for (const source of dataSources) {
      const violation = dataSourceModeViolation(source)
      if (violation) {
        throw new BadRequestException(`Data source "${source.name}": ${violation}`)
      }
    }
  }

  private buildDataSourceFields(sourceData: PluginDataSourceDto, index: number) {
    const mode = sourceData.mode || 'fetch'
    const order = sourceData.order ?? index

    if (mode === 'literal') {
      return {
        name: sourceData.name,
        mode,
        literalValue: sourceData.literalValue ?? null,
        order,
      }
    }

    return {
      name: sourceData.name,
      mode,
      method: sourceData.method || 'GET',
      url: sourceData.url,
      headers: sourceData.headers || {},
      body: sourceData.body || {},
      transformJs: sourceData.transformJs || null,
      order,
    }
  }

  private validateDataSourceNames(dataSources: Array<{ name?: string }>, fields: Array<{ keyname?: string }>): void {
    const seenNames = new Set<string>()

    for (const source of dataSources) {
      const name = source.name?.trim()
      if (!name) {
        throw new BadRequestException('Each data source needs a name')
      }
      if (name === 'trmnl') {
        throw new BadRequestException('Data source name "trmnl" is reserved')
      }
      if (seenNames.has(name)) {
        throw new BadRequestException(`Data source name "${name}" is used by more than one data source`)
      }
      seenNames.add(name)
    }

    for (const field of fields) {
      if (field.keyname && seenNames.has(field.keyname)) {
        throw new BadRequestException(`Data source name "${field.keyname}" collides with a plugin field's keyname`)
      }
    }
  }

  async clearWebhookPayload(id: string): Promise<Plugin> {
    const plugin = await this.requireWebhookPlugin(id)

    await this.pluginRepository.update(id, { webhookPayload: null })
    this.logger.log(`Cleared webhook payload for plugin: ${plugin.name}`)

    return { ...plugin, webhookPayload: null }
  }

  async regenerateWebhookToken(id: string): Promise<Plugin> {
    const plugin = await this.requireWebhookPlugin(id)
    const webhookToken = generateApikey()

    await this.pluginRepository.update(id, { webhookToken })
    this.logger.log(`Regenerated webhook token for plugin: ${plugin.name}`)

    return { ...plugin, webhookToken }
  }

  private async requireWebhookPlugin(id: string): Promise<Plugin> {
    const plugin = await this.pluginRepository.findOneBy({ id })
    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`)
    }
    if (plugin.kind !== 'Webhook') {
      throw new BadRequestException(`Plugin "${plugin.name}" is not a Webhook-kind Plugin`)
    }
    return plugin
  }

  private assertKindFields(fields: PluginKindFields): void {
    const violation = pluginKindFieldViolation(fields)
    if (violation) {
      throw new BadRequestException(violation)
    }
  }

  async checkPluginUsage(id: string): Promise<{ inMashups: Array<{ screenId: string, screenName: string }> }> {
    if (!this.mashupSlotRepository) {
      return { inMashups: [] }
    }

    const mashupsWithPlugin = await this.mashupSlotRepository.find({
      where: { plugin: { id } },
      relations: { mashupConfiguration: { screen: true } },
    })

    return {
      inMashups: mashupsWithPlugin.map(slot => ({
        screenId: slot.mashupConfiguration.screen.id,
        screenName: slot.mashupConfiguration.screen.filename ?? 'Untitled Screen',
      })),
    }
  }

  async remove(id: string, force = false): Promise<boolean> {
    const plugin = await this.pluginRepository.findOneBy({ id })
    if (!plugin)
      return false

    // Check if plugin is used in mashups
    if (!force) {
      const usage = await this.checkPluginUsage(id)
      if (usage.inMashups.length > 0) {
        this.logger.warn(`Plugin ${id} is used in ${usage.inMashups.length} mashup(s)`)
        throw new BadRequestException(
          `Plugin is used in ${usage.inMashups.length} mashup(s). Mashups: ${usage.inMashups.map(m => m.screenName).join(', ')}`,
        )
      }
    }

    this.scheduler.removeScheduledJob(id)
    this.logger.log(`Removed scheduled job for plugin: ${plugin.name}`)

    await this.pluginRepository.remove(plugin)
    return true
  }

  async preview({ sources, template, fieldValues, pluginId }: PreviewPluginDto): Promise<{ html: string, data: Record<string, unknown> }> {
    const savedFieldValues = pluginId ? await this.fieldValues.resolveFor(pluginId, fieldValues) : {}
    const templateContext = this.templateContext.buildFrom('Preview', { ...fieldValues, ...savedFieldValues }, [])

    const data = await this.pluginDataResolver.resolveAll(sources || [], templateContext)
    const templateData: Record<string, unknown> = { ...templateContext, ...data }

    const html = template ? await this.renderer.render(template, templateData) : ''
    return { html, data }
  }
}
