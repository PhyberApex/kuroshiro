import type { PluginDetail, PluginSummary } from 'kuroshiro-shared'
import type { PluginFacts } from '../plugin.mapper.js'
import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { In, IsNull, Repository } from 'typeorm'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { ApiException } from '../../errors/api.exception.js'
import { Screen } from '../../screens/screens.entity.js'
import { Plugin } from '../entities/plugin.entity.js'
import { compareIgnoringCase, toPluginDetail, toPluginSummary } from '../plugin.mapper.js'
import { PluginFieldValuesService } from './plugin-field-values.service.js'

function groupedBy<T>(items: T[], keysOf: (item: T) => string[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    for (const key of keysOf(item))
      groups.set(key, [...groups.get(key) ?? [], item])
  }
  return groups
}

@Injectable()
export class PluginReadsService {
  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly fieldValues: PluginFieldValuesService,
    private readonly configService: ConfigService,
  ) {}

  /** Every Plugin as a row, by name without regard to case. */
  async list(): Promise<PluginSummary[]> {
    const plugins = await this.pluginRepository.find({ relations: { dataSources: true, fields: true } })
    const factsOf = await this.factsByPlugin(plugins.map(plugin => plugin.id))

    return plugins
      .sort((a, b) => compareIgnoringCase(a.name, b.name))
      .map(plugin => toPluginSummary(plugin, factsOf(plugin.id)))
  }

  async detail(id: string): Promise<PluginDetail> {
    const plugin = isUUID(id)
      ? await this.pluginRepository.findOne({ where: { id }, relations: { dataSources: true, templates: true, fields: true } })
      : null
    if (!plugin)
      throw new ApiException(HttpStatus.NOT_FOUND, 'plugin-not-found', 'Plugin not found', { id })

    const facts = (await this.factsByPlugin([id]))(id)
    return toPluginDetail(plugin, {
      ...facts,
      screensByDevice: await this.screensInOrderByDevice(facts.assignmentScreens.map(screen => screen.device.id)),
      now: new Date(),
      apiUrl: this.configService.getOrThrow<string>('api_url'),
    })
  }

  private async factsByPlugin(pluginIds: string[]): Promise<(pluginId: string) => PluginFacts> {
    if (pluginIds.length === 0)
      return () => ({ storedFieldValues: {}, firingDataSourceIds: new Set(), assignmentScreens: [], mashupScreens: [] })

    const [storedFieldValues, firingAlerts, assignmentScreens, mashupScreens] = await Promise.all([
      this.fieldValues.storedByPlugin(pluginIds),
      this.alertRepository.find({
        where: { kind: 'data-source-fetch-failing', resolvedAt: IsNull(), dataSource: { plugin: { id: In(pluginIds) } } },
        relations: { dataSource: true },
      }),
      this.screenRepository.find({
        where: { type: 'plugin', plugin: { id: In(pluginIds) } },
        relations: { plugin: true, device: true },
      }),
      this.screenRepository.find({
        where: { type: 'mashup', mashupConfiguration: { slots: { plugin: { id: In(pluginIds) } } } },
        relations: { device: true, mashupConfiguration: { slots: { plugin: true } } },
      }),
    ])

    const firingDataSourceIds = new Set(firingAlerts.flatMap(alert => alert.dataSource ? [alert.dataSource.id] : []))
    const assignmentsByPlugin = groupedBy(assignmentScreens, screen => screen.plugin ? [screen.plugin.id] : [])
    const mashupsByPlugin = groupedBy(mashupScreens, screen => (screen.mashupConfiguration?.slots ?? []).map(slot => slot.plugin.id))

    return pluginId => ({
      storedFieldValues: storedFieldValues.get(pluginId) ?? {},
      firingDataSourceIds,
      assignmentScreens: assignmentsByPlugin.get(pluginId) ?? [],
      mashupScreens: mashupsByPlugin.get(pluginId) ?? [],
    })
  }

  private async screensInOrderByDevice(deviceIds: string[]): Promise<Map<string, Screen[]>> {
    if (deviceIds.length === 0)
      return new Map()

    const screens = await this.screenRepository.find({
      where: { device: { id: In(deviceIds) } },
      relations: { device: true, schedule: true },
      order: { order: 'ASC' },
    })
    return groupedBy(screens, screen => [screen.device.id])
  }
}
