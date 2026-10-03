import type { RenderSignal, ScreenRead } from 'kuroshiro-shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { In, IsNull, Repository } from 'typeorm'
import { Alert } from '../alerts/entities/alert.entity.js'
import { Device } from '../devices/devices.entity.js'
import { nextRotationAt } from '../devices/next-poll.js'
import { ApiException } from '../errors/api.exception.js'
import { needsValues } from '../plugins/plugin-field-values.js'
import { PluginFieldValuesService } from '../plugins/services/plugin-field-values.service.js'
import { screenStatesOf } from '../schedule/rotation.js'
import { fileExists } from '../utils/fileExists.js'
import { resolveAppPath } from '../utils/pathHelper.js'
import { toScreenRead } from './screen.mapper.js'
import { Screen } from './screens.entity.js'

/** A Screen stores no Render Signal, so none is read. */
function renderSignalOf(_screen: Screen): RenderSignal | null {
  return null
}

@Injectable()
export class ScreenReadsService {
  constructor(
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly fieldValues: PluginFieldValuesService,
  ) {}

  /** A Device's Screens in Order. */
  async forDevice(deviceId: string): Promise<ScreenRead[]> {
    const device = isUUID(deviceId) ? await this.deviceRepository.findOneBy({ id: deviceId }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })

    const screens = await this.screenRepository.find({
      where: { device: { id: deviceId } },
      relations: { schedule: true, plugin: { fields: true }, mashupConfiguration: { slots: { plugin: true } } },
      order: { order: 'ASC' },
    })
    const pluginIds = [...new Set(screens.flatMap(screen => screen.plugin ? [screen.plugin.id] : []))]
    const [renderedIds, storedFieldValues, pluginsWithFetchAlert] = await Promise.all([
      this.renderedScreenIds(deviceId, screens),
      this.fieldValues.storedByPlugin(pluginIds),
      this.pluginIdsWithFiringFetchAlert(pluginIds),
    ])

    const now = new Date()
    const rotationScreens = screens.map(screen => ({ id: screen.id, isActive: screen.isActive, schedule: screen.schedule, renderSignal: renderSignalOf(screen) }))
    const states = screenStatesOf(rotationScreens, { now, nextRotationAt: nextRotationAt(device, now), isMirrored: !!device.mirrorEnabled })

    return screens.map((screen, index) => toScreenRead(screen, {
      deviceId,
      state: states.get(screen.id)!,
      renderSignal: rotationScreens[index].renderSignal,
      isRendered: renderedIds.has(screen.id),
      requiredFieldEmpty: !!screen.plugin && needsValues(screen.plugin.fields ?? [], storedFieldValues.get(screen.plugin.id) ?? {}),
      fetchAlertFiring: !!screen.plugin && pluginsWithFetchAlert.has(screen.plugin.id),
    }))
  }

  /** One Screen, with the Screen State it has among its Device's Screens. */
  async forScreen(screenId: string): Promise<ScreenRead> {
    const owner = isUUID(screenId) ? await this.screenRepository.findOne({ where: { id: screenId }, relations: { device: true } }) : null
    const read = owner && (await this.forDevice(owner.device.id)).find(screen => screen.id === screenId)
    if (!read)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id: screenId })
    return read
  }

  private async renderedScreenIds(deviceId: string, screens: Screen[]): Promise<Set<string>> {
    const rendered = await Promise.all(screens.map(async screen =>
      await fileExists(resolveAppPath('public', 'screens', 'devices', deviceId, `${screen.id}.png`)) ? [screen.id] : [],
    ))
    return new Set(rendered.flat())
  }

  private async pluginIdsWithFiringFetchAlert(pluginIds: string[]): Promise<Set<string>> {
    if (pluginIds.length === 0)
      return new Set()
    const firing = await this.alertRepository.find({
      where: { kind: 'data-source-fetch-failing', resolvedAt: IsNull(), dataSource: { plugin: { id: In(pluginIds) } } },
      relations: { dataSource: { plugin: true } },
    })
    return new Set(firing.flatMap(alert => alert.dataSource ? [alert.dataSource.plugin.id] : []))
  }
}
