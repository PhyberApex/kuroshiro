import type { MashupSlot } from '../mashup/entities/mashup-slot.entity'
import type { AssignPluginToDeviceDto } from './dto/assign-plugin-to-device.dto'
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Screen } from '../screens/screens.entity'
import { DevicePlugin } from './entities/device-plugin.entity'
import { PluginDataSource } from './entities/plugin-data-source.entity'
import { PluginField } from './entities/plugin-field.entity'
import { PluginTemplate } from './entities/plugin-template.entity'
import { Plugin } from './entities/plugin.entity'
import { PluginDataFetcherService } from './services/plugin-data-fetcher.service'
import { PluginRendererService } from './services/plugin-renderer.service'
import { PluginSchedulerService } from './services/plugin-scheduler.service'
import { PluginTransformService } from './services/plugin-transform.service'

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
    private readonly dataFetcher: PluginDataFetcherService,
    private readonly renderer: PluginRendererService,
    private readonly scheduler: PluginSchedulerService,
    private readonly transformer: PluginTransformService,
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

  async findByDevice(deviceId: string): Promise<Plugin[]> {
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
    })) as any
  }

  async assignToDevice(pluginId: string, assignData: AssignPluginToDeviceDto): Promise<DevicePlugin> {
    const devicePlugin = this.devicePluginRepository.create({
      plugin: { id: pluginId } as Plugin,
      device: { id: assignData.deviceId } as any,
      isActive: assignData.isActive ?? true,
      order: assignData.order ?? 0,
    })
    const saved = await this.devicePluginRepository.save(devicePlugin)

    // Create a Screen entity for this plugin assignment
    const maxOrder = await this.screenRepository.maximum('order', { device: { id: assignData.deviceId } }) || 0
    const screen = this.screenRepository.create({
      type: 'plugin',
      device: { id: assignData.deviceId } as any,
      plugin: { id: pluginId } as Plugin,
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

  async updateDeviceAssignment(devicePluginId: string, updates: Partial<DevicePlugin>): Promise<DevicePlugin | null> {
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

  async create(pluginData: Partial<Plugin>): Promise<Plugin> {
    const { dataSources, templates, fields, ...basicFields } = pluginData as any

    this.logger.debug(`Creating plugin with data: ${JSON.stringify({ dataSources, templates, fields, basicFields })}`)

    if (dataSources && Array.isArray(dataSources) && dataSources.length > 0) {
      this.validateDataSourceNames(dataSources, fields || [])
    }

    const pluginToSave = {
      name: basicFields.name,
      description: basicFields.description,
      kind: basicFields.kind || 'Poll',
      refreshInterval: basicFields.refreshInterval || 15,
    }

    const savedPlugin = await this.pluginRepository.save(pluginToSave)

    this.logger.debug(`Saved plugin: ${savedPlugin.id}`)

    if (dataSources && Array.isArray(dataSources) && dataSources.length > 0) {
      this.logger.debug(`Creating ${dataSources.length} data sources`)
      for (const [index, sourceData] of dataSources.entries()) {
        const newDataSource = this.dataSourceRepository.create({
          name: sourceData.name,
          method: sourceData.method || 'GET',
          url: sourceData.url,
          headers: sourceData.headers || {},
          body: sourceData.body || {},
          transformJs: sourceData.transformJs || null,
          order: sourceData.order ?? index,
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

    if (created && created.dataSources && created.dataSources.length > 0 && created.templates && created.templates.length > 0) {
      this.scheduler.schedulePlugin(created)
      this.logger.log(`Scheduled new plugin: ${created.name}`)
    }

    return created
  }

  async update(id: string, pluginData: Partial<Plugin>): Promise<Plugin | null> {
    const plugin = await this.pluginRepository.findOne({
      where: { id },
      relations: { dataSources: true, templates: true, fields: true },
    })
    if (!plugin)
      return null

    const { dataSources, templates, fields, ...basicFields } = pluginData as any

    if (dataSources !== undefined || fields !== undefined) {
      const finalDataSources = dataSources !== undefined ? dataSources : (plugin.dataSources || [])
      const finalFields = fields !== undefined ? fields : (plugin.fields || [])
      this.validateDataSourceNames(finalDataSources, finalFields)
    }

    Object.assign(plugin, basicFields)

    if (dataSources !== undefined) {
      if (plugin.dataSources && plugin.dataSources.length > 0) {
        await this.dataSourceRepository.remove(plugin.dataSources)
      }
      const newDataSources: PluginDataSource[] = []
      if (Array.isArray(dataSources) && dataSources.length > 0) {
        for (const [index, sourceData] of dataSources.entries()) {
          const newDataSource = this.dataSourceRepository.create({
            name: sourceData.name,
            method: sourceData.method || 'GET',
            url: sourceData.url,
            headers: sourceData.headers || {},
            body: sourceData.body || {},
            transformJs: sourceData.transformJs || null,
            order: sourceData.order ?? index,
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
        screenName: slot.mashupConfiguration.screen.filename,
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

  async preview(sources: Array<{ name: string, url: string, method: string, headers?: Record<string, string>, body?: any, transformJs?: string }>, template?: string, fieldValues?: Record<string, string>): Promise<{ html: string, data: Record<string, any> }> {
    // Build template context with trmnl system variables and plugin field values
    const templateContext: any = {
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

    const results = await Promise.allSettled(
      (sources || []).map(async (source) => {
        let rawData = await this.dataFetcher.fetchData(source.method, source.url, source.headers, source.body, templateContext)
        if (source.transformJs) {
          this.logger.debug(`Applying transform.js to data source: ${source.name}`)
          rawData = this.transformer.transform(source.transformJs, rawData)
        }
        return rawData
      }),
    )

    const data: Record<string, any> = {}
    results.forEach((result, index) => {
      const name = sources[index].name
      if (result.status === 'fulfilled') {
        data[name] = result.value
      }
      else {
        this.logger.warn(`Data source "${name}" failed during preview: ${result.reason?.message || result.reason}`)
        data[name] = { error: true, message: result.reason?.message || String(result.reason) }
      }
    })

    const templateData: any = { ...templateContext, ...data }

    const html = template ? await this.renderer.render(template, templateData) : ''
    return { html, data }
  }
}
