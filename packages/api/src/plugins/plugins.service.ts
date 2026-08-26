import type { MashupSlot } from '../mashup/entities/mashup-slot.entity'
import type { AssignPluginToDeviceDto } from './dto/assign-plugin-to-device.dto'
import type { CreatePluginDto } from './dto/create-plugin.dto'
import type { PluginDataSourceDto } from './dto/plugin-data-source.dto'
import type { PreviewSourceDto } from './dto/preview-plugin.dto'
import type { UpdateDeviceAssignmentDto } from './dto/update-device-assignment.dto'
import type { UpdatePluginDto } from './dto/update-plugin.dto'
import type { DevicePluginView } from './entities/plugin.entity'
import type { PluginKindFields } from './plugin-kind-fields'
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Screen } from '../screens/screens.entity'
import generateApikey from '../utils/generateApikey'
import { DevicePlugin } from './entities/device-plugin.entity'
import { PluginDataSource } from './entities/plugin-data-source.entity'
import { PluginField } from './entities/plugin-field.entity'
import { PluginTemplate } from './entities/plugin-template.entity'
import { Plugin } from './entities/plugin.entity'
import { dataSourceModeViolation } from './plugin-data-source-mode'
import { pluginKindFieldViolation } from './plugin-kind-fields'
import { PluginDataResolverService } from './services/plugin-data-resolver.service'
import { PluginRendererService } from './services/plugin-renderer.service'
import { PluginSchedulerService } from './services/plugin-scheduler.service'

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly logger = new Logger(PluginsService.name)

  private mashupSlotRepository: Repository<MashupSlot>

  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(DevicePlugin)
    private readonly devicePluginRepository: Repository<DevicePlugin>,
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

  async findAll(): Promise<Plugin[]> {
    return this.pluginRepository.find({
      relations: { dataSources: true, templates: true, fields: true },
      order: { name: 'ASC' },
    })
  }

  async findById(id: string): Promise<Plugin | null> {
    return this.pluginRepository.findOne({
      where: { id },
      relations: { dataSources: true, templates: true, fields: true, deviceAssignments: { device: true } },
    })
  }

  async findByDevice(deviceId: string): Promise<DevicePluginView[]> {
    const devicePlugins = await this.devicePluginRepository.find({
      where: { device: { id: deviceId } },
      relations: { plugin: { dataSources: true, templates: true, fields: true } },
      order: { order: 'ASC' },
    })

    return devicePlugins.map(dp => ({
      ...dp.plugin,
      _devicePluginId: dp.id,
      _isActive: dp.isActive,
      _order: dp.order,
    }))
  }

  async assignToDevice(pluginId: string, assignData: AssignPluginToDeviceDto): Promise<DevicePlugin> {
    const devicePlugin = this.devicePluginRepository.create({
      plugin: { id: pluginId },
      device: { id: assignData.deviceId },
      isActive: assignData.isActive ?? true,
      order: assignData.order ?? 0,
    })
    const saved = await this.devicePluginRepository.save(devicePlugin)

    // Create a Screen entity for this plugin assignment
    const maxOrder = await this.screenRepository.maximum('order', { device: { id: assignData.deviceId } }) || 0
    const screen = this.screenRepository.create({
      type: 'plugin',
      device: { id: assignData.deviceId },
      plugin: { id: pluginId },
      devicePluginId: saved.id,
      isActive: assignData.isActive ?? true,
      order: maxOrder + 1,
      generatedAt: new Date(),
      fetchManual: false,
    })
    await this.screenRepository.save(screen)

    return saved
  }

  async unassignFromDevice(pluginId: string, deviceId: string): Promise<boolean> {
    const devicePlugin = await this.devicePluginRepository.findOne({
      where: { plugin: { id: pluginId }, device: { id: deviceId } },
    })
    if (!devicePlugin)
      return false

    // Delete associated Screen
    await this.screenRepository.delete({ devicePluginId: devicePlugin.id })

    await this.devicePluginRepository.remove(devicePlugin)
    return true
  }

  async updateDeviceAssignment(devicePluginId: string, updates: UpdateDeviceAssignmentDto): Promise<DevicePlugin | null> {
    const devicePlugin = await this.devicePluginRepository.findOneBy({ id: devicePluginId })
    if (!devicePlugin)
      return null
    Object.assign(devicePlugin, updates)
    const saved = await this.devicePluginRepository.save(devicePlugin)

    // Update associated Screen's isActive state
    if (updates.isActive !== undefined) {
      await this.screenRepository.update(
        { devicePluginId },
        { isActive: updates.isActive },
      )
    }

    return saved
  }

  async create(pluginData: CreatePluginDto): Promise<Plugin> {
    const { dataSources, templates, fields, ...basicFields } = pluginData

    this.logger.debug(`Creating plugin with data: ${JSON.stringify({ dataSources, templates, fields, basicFields })}`)

    if (dataSources && Array.isArray(dataSources) && dataSources.length > 0) {
      this.validateDataSourceNames(dataSources, fields || [])
      this.assertDataSourceModeFields(dataSources)
    }

    const kind = basicFields.kind || 'Poll'

    this.assertKindFields({
      kind,
      dataSources,
      webhookToken: basicFields.webhookToken,
      mergeStrategy: basicFields.mergeStrategy,
      streamLimit: basicFields.streamLimit,
    })

    const pluginToSave = {
      name: basicFields.name,
      description: basicFields.description,
      kind,
      refreshInterval: basicFields.refreshInterval || 15,
      sourceRecipeId: basicFields.sourceRecipeId,
      ...(kind === 'Webhook'
        ? {
            webhookToken: generateApikey(),
            mergeStrategy: basicFields.mergeStrategy,
            streamLimit: basicFields.streamLimit ?? null,
          }
        : {}),
    }

    const savedPlugin = await this.pluginRepository.save(pluginToSave)

    this.logger.debug(`Saved plugin: ${savedPlugin.id}`)

    if (dataSources && Array.isArray(dataSources) && dataSources.length > 0) {
      this.logger.debug(`Creating ${dataSources.length} data sources`)
      for (const [index, sourceData] of dataSources.entries()) {
        const newDataSource = this.dataSourceRepository.create({
          ...this.buildDataSourceFields(sourceData, index),
          plugin: savedPlugin,
        })
        await this.dataSourceRepository.save(newDataSource)
        this.logger.debug(`Saved data source: ${newDataSource.name}`)
      }
    }

    if (templates && Array.isArray(templates) && templates.length > 0) {
      this.logger.debug(`Creating ${templates.length} templates`)
      for (const templateData of templates) {
        const newTemplate = this.templateRepository.create({
          layout: templateData.layout || 'full',
          liquidMarkup: templateData.liquidMarkup,
          plugin: savedPlugin,
        })
        await this.templateRepository.save(newTemplate)
        this.logger.debug(`Saved template`)
      }
    }

    if (fields && Array.isArray(fields) && fields.length > 0) {
      this.logger.debug(`Creating ${fields.length} fields`)
      for (const fieldData of fields) {
        const newField = this.fieldRepository.create({
          keyname: fieldData.keyname,
          fieldType: fieldData.fieldType || 'string',
          name: fieldData.name,
          description: fieldData.description,
          defaultValue: fieldData.defaultValue,
          required: fieldData.required || false,
          order: fieldData.order || 0,
          plugin: savedPlugin,
        })
        await this.fieldRepository.save(newField)
        this.logger.debug(`Saved field: ${newField.keyname}`)
      }
    }

    const created = await this.pluginRepository.findOne({
      where: { id: savedPlugin.id },
      relations: { dataSources: true, templates: true, fields: true },
    })

    if (!created)
      throw new Error(`Failed to load newly created plugin: ${savedPlugin.id}`)

    if (created.dataSources && created.dataSources.length > 0 && created.templates && created.templates.length > 0) {
      this.scheduler.schedulePlugin(created)
      this.logger.log(`Scheduled new plugin: ${created.name}`)
    }

    return created
  }

  async update(id: string, pluginData: UpdatePluginDto): Promise<Plugin | null> {
    const plugin = await this.pluginRepository.findOne({
      where: { id },
      relations: { dataSources: true, templates: true, fields: true },
    })
    if (!plugin)
      return null

    const { dataSources, templates, fields, webhookToken, ...rawBasicFields } = pluginData

    // class-transformer's plainToInstance (the real ValidationPipe path) gives every declared
    // UpdatePluginDto field an own property equal to `undefined` even when the caller never sent
    // it, so unset fields must be dropped here before they reach the Object.assign below —
    // otherwise a partial PATCH would blank out every field the caller omitted.
    const basicFields = Object.fromEntries(
      Object.entries(rawBasicFields).filter(([, value]) => value !== undefined),
    ) as typeof rawBasicFields

    if (basicFields.kind !== undefined && basicFields.kind !== plugin.kind) {
      throw new BadRequestException(`A Plugin's Kind is fixed at creation and cannot be changed`)
    }

    if (dataSources !== undefined || fields !== undefined) {
      const finalDataSources = dataSources !== undefined ? dataSources : (plugin.dataSources || [])
      const finalFields = fields !== undefined ? fields : (plugin.fields || [])
      this.validateDataSourceNames(finalDataSources, finalFields)
    }

    if (dataSources !== undefined && Array.isArray(dataSources) && dataSources.length > 0) {
      this.assertDataSourceModeFields(dataSources)
    }

    const mergeStrategy = basicFields.mergeStrategy !== undefined ? basicFields.mergeStrategy : plugin.mergeStrategy
    const streamLimit = mergeStrategy === 'stream' ? basicFields.streamLimit ?? plugin.streamLimit : basicFields.streamLimit

    this.assertKindFields({
      kind: plugin.kind,
      dataSources: dataSources ?? plugin.dataSources,
      webhookToken: webhookToken === plugin.webhookToken ? undefined : webhookToken,
      mergeStrategy,
      streamLimit,
    })

    Object.assign(plugin, basicFields, plugin.kind === 'Webhook' ? { mergeStrategy, streamLimit: streamLimit ?? null } : {})

    if (dataSources !== undefined) {
      if (plugin.dataSources && plugin.dataSources.length > 0) {
        await this.dataSourceRepository.remove(plugin.dataSources)
      }
      const newDataSources: PluginDataSource[] = []
      if (Array.isArray(dataSources) && dataSources.length > 0) {
        for (const [index, sourceData] of dataSources.entries()) {
          const newDataSource = this.dataSourceRepository.create({
            ...this.buildDataSourceFields(sourceData, index),
            plugin,
          })
          newDataSources.push(await this.dataSourceRepository.save(newDataSource))
        }
      }
      plugin.dataSources = newDataSources
    }

    if (templates && Array.isArray(templates) && templates.length > 0) {
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

    if (fields && Array.isArray(fields)) {
      // Delete existing fields
      if (plugin.fields && plugin.fields.length > 0) {
        await this.fieldRepository.remove(plugin.fields)
      }
      // Create new fields
      if (fields.length > 0) {
        this.logger.debug(`Updating ${fields.length} fields`)
        for (const fieldData of fields) {
          const newField = this.fieldRepository.create({
            keyname: fieldData.keyname,
            fieldType: fieldData.fieldType || 'string',
            name: fieldData.name,
            description: fieldData.description,
            defaultValue: fieldData.defaultValue,
            required: fieldData.required || false,
            order: fieldData.order || 0,
            plugin,
          })
          await this.fieldRepository.save(newField)
        }
      }
    }

    const updated = await this.pluginRepository.save(plugin)

    // Reschedule if dataSources or templates changed
    if (dataSources !== undefined || templates) {
      this.scheduler.removeScheduledJob(id)
      const fullPlugin = await this.pluginRepository.findOne({
        where: { id },
        relations: { dataSources: true, templates: true },
      })
      if (fullPlugin && fullPlugin.dataSources && fullPlugin.dataSources.length > 0 && fullPlugin.templates && fullPlugin.templates.length > 0) {
        this.scheduler.schedulePlugin(fullPlugin)
        this.logger.log(`Rescheduled plugin: ${fullPlugin.name}`)
      }
    }

    return updated
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

  async preview(sources: PreviewSourceDto[], template?: string, fieldValues?: Record<string, string>): Promise<{ html: string, data: Record<string, unknown> }> {
    // Build template context with trmnl system variables and plugin field values
    const templateContext: Record<string, unknown> = {
      trmnl: {
        system: {
          timestamp_utc: Math.floor(Date.now() / 1000),
        },
        plugin_settings: {
          instance_name: 'Preview',
          strategy: 'polling',
          dark_mode: 'no',
          no_screen_padding: 'no',
        },
        user: {
          id: 'preview-user',
          locale: 'en',
        },
      },
    }

    // Add plugin field values to root context
    if (fieldValues) {
      Object.assign(templateContext, fieldValues)
    }

    const data = await this.pluginDataResolver.resolveAll(sources || [], templateContext)
    const templateData: Record<string, unknown> = { ...templateContext, ...data }

    const html = template ? await this.renderer.render(template, templateData) : ''
    return { html, data }
  }
}
