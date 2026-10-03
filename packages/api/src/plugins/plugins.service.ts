import type { ApiErrorField, PluginKind } from 'kuroshiro-shared'
import type { EntityManager, FindOptionsRelations } from 'typeorm'
import type { MashupSlot } from '../mashup/entities/mashup-slot.entity.js'
import type { CreatePluginDto } from './dto/create-plugin.dto.js'
import type { PluginDataSourceDto } from './dto/plugin-data-source.dto.js'
import type { PluginFieldDto } from './dto/plugin-field.dto.js'
import type { PluginTemplateDto } from './dto/plugin-template.dto.js'
import type { UpdateDataSourceDto, UpdatePluginDto, UpdateTemplateDto } from './dto/update-plugin.dto.js'
import type { PluginKindFields } from './plugin-kind-fields.js'
import type { PluginWithFieldValues } from './services/plugin-field-values.service.js'
import { BadRequestException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { ApiException, ValidationException } from '../errors/api.exception.js'
import { Screen } from '../screens/screens.entity.js'
import generateApikey from '../utils/generateApikey.js'
import { PluginDataSource } from './entities/plugin-data-source.entity.js'
import { PluginField } from './entities/plugin-field.entity.js'
import { PluginTemplate } from './entities/plugin-template.entity.js'
import { Plugin } from './entities/plugin.entity.js'
import { dataSourceModeViolation } from './plugin-data-source-mode.js'
import { pluginKindFieldViolation } from './plugin-kind-fields.js'
import { PluginFieldValuesService } from './services/plugin-field-values.service.js'
import { PluginRenderCacheService } from './services/plugin-render-cache.service.js'
import { PluginSchedulerService } from './services/plugin-scheduler.service.js'

// A `literal` Data Source is never fetched, so one switched to it starts over (ADR-0025).
const NO_FETCH_OUTCOME = { fetchFailureStreak: 0, lastFetchAttemptAt: null, lastFetchSucceededAt: null, lastFetchError: null }

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
    private readonly scheduler: PluginSchedulerService,
    private readonly renderCache: PluginRenderCacheService,
    private readonly fieldValues: PluginFieldValuesService,
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

    // A timer counts from now, so without a tick at start an Instance restarted
    // more often than a refresh interval would never run that Plugin.
    for (const plugin of plugins) {
      this.schedule(plugin, `Scheduled plugin: ${plugin.name}`)
      if (this.scheduler.hasScheduledJob(plugin.id)) {
        void this.scheduler.runTick(plugin)
      }
    }
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

  /** `snapshotTakenAt` says when the Recipe Snapshot being saved was taken, for one taken before this call. */
  async create(pluginData: CreatePluginDto, { snapshotTakenAt }: { snapshotTakenAt?: Date | null } = {}): Promise<PluginWithFieldValues> {
    const { dataSources, templates, fields, fieldValues, ...basicFields } = pluginData

    this.logger.debug(`Creating plugin with data: ${JSON.stringify({ dataSources, templates, fields, basicFields })}`)

    this.validateNewChildren(dataSources, fields)
    this.assertOneTemplatePerSize((templates ?? []).map(template => template.layout || 'full'), 'layout')
    this.fieldValues.assertWritable(fields, fieldValues)

    const kind = basicFields.kind || 'Poll'

    this.assertKindFields({
      kind,
      dataSources,
      webhookToken: basicFields.webhookToken,
      mergeStrategy: basicFields.mergeStrategy,
      streamLimit: basicFields.streamLimit,
    })

    const savedPlugin = await this.pluginRepository.save(this.buildPluginToSave(basicFields, kind, snapshotTakenAt ?? new Date()))
    this.logger.debug(`Saved plugin: ${savedPlugin.id}`)

    await this.createDataSources(savedPlugin, dataSources)
    await this.createTemplates(savedPlugin, templates)
    await this.createFields(savedPlugin, fields)

    const created = await this.reloadPlugin(savedPlugin.id)
    await this.fieldValues.write(created, fieldValues)
    this.schedule(created, `Scheduled new plugin: ${created.name}`)

    return this.withFieldValues(created)
  }

  async duplicate(id: string): Promise<PluginWithFieldValues> {
    const source = await this.findPluginWithRelations(id, { dataSources: true, templates: true, fields: true })
    if (!source) {
      throw new NotFoundException(`Plugin ${id} not found`)
    }

    return this.create(
      { ...this.buildDuplicateDto(source), fieldValues: await this.fieldValues.storedFor(id) },
      { snapshotTakenAt: source.snapshotTakenAt },
    )
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
        headers: ds.headers ?? undefined,
        body: ds.body ?? undefined,
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

  private buildPluginToSave(basicFields: Omit<CreatePluginDto, 'dataSources' | 'templates' | 'fields'>, kind: PluginKind, snapshotTakenAt: Date) {
    return {
      name: basicFields.name,
      description: basicFields.description,
      kind,
      refreshInterval: basicFields.refreshInterval || 15,
      sourceRecipeId: basicFields.sourceRecipeId,
      sourceRecipeSnapshot: basicFields.sourceRecipeSnapshot,
      snapshotTakenAt: basicFields.sourceRecipeSnapshot ? snapshotTakenAt : null,
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
    await this.persistFields(this.fieldRepository, plugin, fields)
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
  private async persistFields(repository: Repository<PluginField>, plugin: Plugin, fields: PluginFieldDto[], existingFields: PluginField[] = []): Promise<PluginField[]> {
    const saved: PluginField[] = []
    for (const fieldData of fields) {
      const existing = existingFields.find(field => field.keyname === fieldData.keyname)
      const field = existing
        ? Object.assign(existing, this.buildFieldFields(fieldData))
        : repository.create({ ...this.buildFieldFields(fieldData), plugin })
      saved.push(await repository.save(field))
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

  private schedule(plugin: Plugin, message: string): void {
    this.scheduler.schedulePlugin(plugin)
    if (this.scheduler.hasScheduledJob(plugin.id)) {
      this.logger.log(message)
    }
  }

  /** Saves everything the input carries, or nothing. A key left out keeps what is stored. */
  async update(id: string, pluginData: UpdatePluginDto): Promise<void> {
    await this.pluginRepository.manager.transaction(async (manager) => {
      const plugin = isUUID(id)
        ? await manager.findOne(Plugin, { where: { id }, relations: { dataSources: true, templates: true, fields: true } })
        : null
      if (!plugin)
        throw new ApiException(HttpStatus.NOT_FOUND, 'plugin-not-found', 'Plugin not found', { id })

      const { dataSources, templates, fields, fieldValues, ...basicFields } = pluginData

      this.assertSavable(plugin, pluginData)
      this.fieldValues.assertWritable(fields ?? plugin.fields, fieldValues)

      if (dataSources) {
        await this.saveDataSources(manager, plugin, dataSources)
      }
      if (templates) {
        await this.saveTemplates(manager, plugin, templates)
      }
      const savedFields = fields ? await this.saveFields(manager, plugin, fields) : plugin.fields
      await manager.update(Plugin, id, basicFields)
      await this.fieldValues.within(manager).write({ id, fields: savedFields }, fieldValues)
    })

    await this.refreshRendersAfterSave(id)
  }

  /**
   * Runs once a save is committed, so a failure here is logged and the save
   * still answers. The scheduler's job holds the Plugin as it was loaded, so
   * it is replaced on every save, and the tick started here is not awaited: a
   * save does not wait for a Data Source.
   */
  private async refreshRendersAfterSave(id: string): Promise<void> {
    try {
      await this.invalidateRenderCaches(id)

      const plugin = await this.findPluginWithRelations(id, { dataSources: true, templates: true })
      if (!plugin)
        return

      this.schedule(plugin, `Rescheduled plugin: ${plugin.name}`)
      if (plugin.templates.length > 0) {
        void this.scheduler.runTick(plugin)
      }
    }
    catch (error) {
      this.logger.error(`Plugin ${id} was saved, but its renders could not be refreshed`, error)
    }
  }

  private assertSavable(plugin: Plugin, { refreshInterval, dataSources, fields, templates }: UpdatePluginDto): void {
    if (templates) {
      this.assertOneTemplatePerSize(templates.map(template => template.size), 'size')
      if (!templates.some(template => template.size === 'full')) {
        throw new ApiException(HttpStatus.BAD_REQUEST, 'template-full-missing', 'A Plugin needs a Template of size full')
      }
    }

    if (plugin.kind === 'Webhook' && refreshInterval !== undefined) {
      throw new ValidationException([{ path: 'refreshInterval', message: 'A Webhook-kind Plugin has no refresh interval' }])
    }
    if (plugin.kind === 'Webhook' && dataSources?.length) {
      throw new ValidationException([{ path: 'dataSources', message: 'A Webhook-kind Plugin cannot have Data Sources' }])
    }

    if (dataSources) {
      this.validateDataSourceNames(dataSources, fields ?? plugin.fields)
    }
    else if (fields) {
      this.assertNoKeynameIsADataSourceName(fields, plugin.dataSources)
    }

    const ownIds = new Set(plugin.dataSources.map(source => source.id))
    const seenIds = new Set<string>()
    const violations = (dataSources ?? []).flatMap(({ id: sourceId }, index): ApiErrorField[] => {
      if (!sourceId)
        return []
      const path = `dataSources.${index}.id`
      if (!ownIds.has(sourceId))
        return [{ path, message: 'This Plugin has no Data Source of that id' }]
      if (seenIds.has(sourceId))
        return [{ path, message: 'A Data Source can be saved only once' }]
      seenIds.add(sourceId)
      return []
    })
    if (violations.length > 0) {
      throw new ValidationException(violations)
    }
  }

  private assertOneTemplatePerSize(sizes: string[], key: 'size' | 'layout'): void {
    const violations = sizes.flatMap((size, index): ApiErrorField[] => sizes.indexOf(size) < index
      ? [{ path: `templates.${index}.${key}`, message: `There is more than one Template of size "${size}"` }]
      : [])
    if (violations.length > 0) {
      throw new ValidationException(violations)
    }
  }

  private assertNoKeynameIsADataSourceName(fields: PluginFieldDto[], dataSources: PluginDataSource[]): void {
    const names = new Set(dataSources.map(source => source.name))
    const violations = fields.flatMap((field, index): ApiErrorField[] => names.has(field.keyname)
      ? [{ path: `fields.${index}.keyname`, message: `Plugin field keyname "${field.keyname}" collides with a data source's name` }]
      : [])
    if (violations.length > 0) {
      throw new ValidationException(violations)
    }
  }

  // A Data Source saved by its id is updated in place, so it keeps its Fetch
  // Failure Streak, its last fetch facts and its firing Alert (ADR-0025).
  private async saveDataSources(manager: EntityManager, plugin: Plugin, dataSources: UpdateDataSourceDto[]): Promise<void> {
    const repository = manager.getRepository(PluginDataSource)
    const storedById = new Map(plugin.dataSources.map(stored => [stored.id, stored]))
    const keptIds = new Set(dataSources.map(source => source.id))
    const removed = plugin.dataSources.filter(stored => !keptIds.has(stored.id))
    if (removed.length > 0) {
      await repository.remove(removed)
    }

    for (const [index, sourceData] of dataSources.entries()) {
      const stored = sourceData.id ? storedById.get(sourceData.id) : undefined
      const columns = this.buildDataSourceFields(sourceData, index)
      await repository.save(stored
        ? Object.assign(stored, columns, columns.mode === 'literal' ? NO_FETCH_OUTCOME : {})
        : repository.create({ ...columns, plugin: { id: plugin.id } }))
    }
  }

  private async persistDataSources(plugin: Plugin, dataSources: PluginDataSourceDto[]): Promise<void> {
    for (const [index, sourceData] of dataSources.entries()) {
      const newDataSource = this.dataSourceRepository.create({
        ...this.buildDataSourceFields(sourceData, index),
        plugin,
      })
      await this.dataSourceRepository.save(newDataSource)
      this.logger.debug(`Saved data source: ${newDataSource.name}`)
    }
  }

  private async saveTemplates(manager: EntityManager, plugin: Plugin, templates: UpdateTemplateDto[]): Promise<void> {
    const repository = manager.getRepository(PluginTemplate)
    const sizes = new Set<string>(templates.map(template => template.size))
    const removed = plugin.templates.filter(stored => !sizes.has(stored.layout))
    if (removed.length > 0) {
      await repository.remove(removed)
    }

    for (const { size, liquidMarkup } of templates) {
      const stored = plugin.templates.find(candidate => candidate.layout === size)
      await repository.save(stored
        ? Object.assign(stored, { liquidMarkup })
        : repository.create({ layout: size, liquidMarkup, plugin: { id: plugin.id } }))
    }
  }

  private async saveFields(manager: EntityManager, plugin: Plugin, fields: PluginFieldDto[]): Promise<PluginField[]> {
    const repository = manager.getRepository(PluginField)
    const removed = plugin.fields.filter(existing => !fields.some(field => field.keyname === existing.keyname))
    if (removed.length > 0) {
      await repository.remove(removed)
    }

    return this.persistFields(repository, plugin, fields, plugin.fields)
  }

  // Public: also called by RecipeUpdateService, whose Recipe Update apply
  // writes Data Sources, Templates and Plugin Fields itself (ADR-0030's
  // whole-item apply does not fit `update()`), and needs the same cache
  // invalidation and rescheduling afterwards.
  async invalidateRenderCaches(pluginId: string): Promise<void> {
    await this.screenRepository.update({ plugin: { id: pluginId } }, { cachedPluginOutput: null })
    await this.renderCache.invalidateMashupCaches(pluginId)
  }

  async rescheduleAfterUpdate(id: string): Promise<void> {
    const fullPlugin = await this.findPluginWithRelations(id, { dataSources: true, templates: true })
    if (fullPlugin) {
      this.schedule(fullPlugin, `Rescheduled plugin: ${fullPlugin.name}`)
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

  /** A column the mode does not use is `null` (`method`, which cannot be, its default), so a Data Source saved under the other mode drops what it held. */
  private buildDataSourceFields(sourceData: PluginDataSourceDto, index: number) {
    const mode = sourceData.mode || 'fetch'
    const common = { name: sourceData.name, mode, order: sourceData.order ?? index }

    if (mode === 'literal') {
      return { ...common, method: 'GET', url: null, headers: null, body: null, transformJs: null, literalValue: sourceData.literalValue ?? null }
    }

    return {
      ...common,
      method: sourceData.method || 'GET',
      url: sourceData.url,
      headers: sourceData.headers || {},
      body: sourceData.body || {},
      transformJs: sourceData.transformJs || null,
      literalValue: null,
    }
  }

  private validateDataSourceNames(dataSources: Array<{ name?: string }>, fields: Array<{ keyname?: string }>): void {
    const seenNames = new Set<string>()
    const keynames = new Set(fields.map(field => field.keyname))

    const violations = dataSources.flatMap((source, index): ApiErrorField[] => {
      const path = `dataSources.${index}.name`
      const name = source.name?.trim()
      if (!name)
        return [{ path, message: 'Each data source needs a name' }]
      if (name === 'trmnl')
        return [{ path, message: 'Data source name "trmnl" is reserved' }]
      if (seenNames.has(name))
        return [{ path, message: `Data source name "${name}" is used by more than one data source` }]
      seenNames.add(name)
      return keynames.has(name) ? [{ path, message: `Data source name "${name}" collides with a plugin field's keyname` }] : []
    })

    if (violations.length > 0) {
      throw new ValidationException(violations)
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
}
