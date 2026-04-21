import type { AssignPluginToDeviceDto } from './dto/assign-plugin-to-device.dto'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
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
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing plugin scheduler...')
    const plugins = await this.pluginRepository.find({
      relations: ['dataSource', 'templates'],
    })

    for (const plugin of plugins) {
      if (plugin.dataSource && plugin.templates && plugin.templates.length > 0) {
        this.scheduler.schedulePlugin(plugin)
        this.logger.log(`Scheduled plugin: ${plugin.name}`)
      }
    }
  }

  async findAll(): Promise<Plugin[]> {
    return this.pluginRepository.find({
      relations: ['dataSource', 'templates', 'fields'],
      order: { name: 'ASC' },
    })
  }

  async findById(id: string): Promise<Plugin | null> {
    return this.pluginRepository.findOne({
      where: { id },
      relations: ['dataSource', 'templates', 'fields', 'deviceAssignments', 'deviceAssignments.device'],
    })
  }

  async findByDevice(deviceId: string): Promise<Plugin[]> {
    const devicePlugins = await this.devicePluginRepository.find({
      where: { device: { id: deviceId } },
      relations: ['plugin', 'plugin.dataSource', 'plugin.templates', 'plugin.fields'],
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
    const { dataSource, templates, fields, ...basicFields } = pluginData as any

    this.logger.debug(`Creating plugin with data: ${JSON.stringify({ dataSource, templates, fields, basicFields })}`)

    const pluginToSave = {
      name: basicFields.name,
      description: basicFields.description,
      kind: basicFields.kind || 'Poll',
      refreshInterval: basicFields.refreshInterval || 15,
    }

    const savedPlugin = await this.pluginRepository.save(pluginToSave)

    this.logger.debug(`Saved plugin: ${savedPlugin.id}`)

    if (dataSource) {
      this.logger.debug(`Creating dataSource: ${JSON.stringify(dataSource)}`)
      const newDataSource = this.dataSourceRepository.create({
        method: dataSource.method || 'GET',
        url: dataSource.url,
        headers: dataSource.headers || {},
        body: dataSource.body || {},
        transformJs: dataSource.transformJs || null,
        plugin: savedPlugin,
      })
      await this.dataSourceRepository.save(newDataSource)
      this.logger.debug(`Saved dataSource`)
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
      relations: ['dataSource', 'templates', 'fields'],
    })

    if (created && created.dataSource && created.templates && created.templates.length > 0) {
      this.scheduler.schedulePlugin(created)
      this.logger.log(`Scheduled new plugin: ${created.name}`)
    }

    return created
  }

  async update(id: string, pluginData: Partial<Plugin>): Promise<Plugin | null> {
    const plugin = await this.pluginRepository.findOne({
      where: { id },
      relations: ['dataSource', 'templates', 'fields'],
    })
    if (!plugin)
      return null

    const { dataSource, templates, fields, ...basicFields } = pluginData as any

    Object.assign(plugin, basicFields)

    if (dataSource) {
      if (plugin.dataSource) {
        Object.assign(plugin.dataSource, dataSource)
        await this.dataSourceRepository.save(plugin.dataSource)
      }
      else {
        const newDataSource = this.dataSourceRepository.create({
          ...dataSource,
          plugin,
        })
        await this.dataSourceRepository.save(newDataSource)
      }
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

    // Reschedule if dataSource or templates changed
    if (dataSource || templates) {
      this.scheduler.removeScheduledJob(id)
      const fullPlugin = await this.pluginRepository.findOne({
        where: { id },
        relations: ['dataSource', 'templates'],
      })
      if (fullPlugin && fullPlugin.dataSource && fullPlugin.templates && fullPlugin.templates.length > 0) {
        this.scheduler.schedulePlugin(fullPlugin)
        this.logger.log(`Rescheduled plugin: ${fullPlugin.name}`)
      }
    }

    return updated
  }

  async remove(id: string): Promise<boolean> {
    const plugin = await this.pluginRepository.findOneBy({ id })
    if (!plugin)
      return false

    this.scheduler.removeScheduledJob(id)
    this.logger.log(`Removed scheduled job for plugin: ${plugin.name}`)

    await this.pluginRepository.remove(plugin)
    return true
  }

  async preview(url: string, method: string, headers?: Record<string, string>, body?: any, template?: string, transformJs?: string, fieldValues?: Record<string, string>): Promise<{ html: string, data: any }> {
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

    let rawData = await this.dataFetcher.fetchData(method, url, headers, body, templateContext)

    // Apply transform if provided
    if (transformJs) {
      this.logger.debug('Applying transform.js to fetched data')
      rawData = this.transformer.transform(transformJs, rawData)
    }

    this.logger.debug(`Raw data from API: ${JSON.stringify(rawData).substring(0, 200)}...`)

    // Try to detect variable names from template
    const detectedVars: string[] = []
    if (template) {
      const varMatches = template.matchAll(/\{\{\s*(\w+)\s*[|}]/g)
      for (const match of varMatches) {
        const varName = match[1]
        if (varName !== 'trmnl' && !detectedVars.includes(varName)) {
          detectedVars.push(varName)
        }
      }
    }

    this.logger.debug(`Detected template variables: ${detectedVars.join(', ')}`)

    // Wrap data in TRMNL-compatible structure
    const templateData: any = { ...templateContext }

    // If API returns object, spread it at root level
    if (typeof rawData === 'object' && rawData !== null && !Array.isArray(rawData)) {
      Object.assign(templateData, rawData)
    }
    // If API returns array, assign to detected variable names OR common fallbacks
    else if (Array.isArray(rawData)) {
      // Use first detected variable if available
      const primaryVar = detectedVars[0] || 'data'
      templateData[primaryVar] = rawData
      this.logger.debug(`Assigned array data to variable: ${primaryVar}`)
      // Also set common fallbacks
      templateData.data = rawData
      templateData.items = rawData
    }
    // Primitive value
    else {
      templateData.data = rawData
    }

    const html = template ? await this.renderer.renderForDisplay(template, templateData) : ''
    return { html, data: rawData } // Return raw data for display in preview tab
  }
}
