import type { PreviewData } from 'kuroshiro-shared'
import type { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import type { PreviewDataDto } from '../dto/preview-data.dto.js'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import { Device } from '../../devices/devices.entity.js'
import { ApiException } from '../../errors/api.exception.js'
import { Plugin } from '../entities/plugin.entity.js'
import { toPreviewData } from '../plugin.mapper.js'
import { PluginTemplateContextService } from './plugin-template-context.service.js'

/**
 * The data the browser's preview of a Plugin draws against: the context a
 * render on the server would read, built from the form as it stands. It
 * renders nothing and stores nothing, so it moves no Fetch Failure Streak
 * (ADR-0025).
 */
@Injectable()
export class PluginPreviewDataService {
  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly deviceSensors: DeviceSensorsService,
    private readonly templateContext: PluginTemplateContextService,
  ) {}

  async previewData(pluginId: string, { deviceId, name, dataSources, fieldValues }: PreviewDataDto): Promise<PreviewData> {
    const plugin = isUUID(pluginId)
      ? await this.pluginRepository.findOne({ where: { id: pluginId }, relations: { dataSources: true, fields: true }, order: { dataSources: { order: 'ASC' } } })
      : null
    if (!plugin)
      throw new ApiException(HttpStatus.NOT_FOUND, 'plugin-not-found', 'Plugin not found', { id: pluginId })

    const sensors = deviceId ? await this.sensorsOf(deviceId) : []
    const rendering = await this.templateContext.contextFor(plugin, sensors, { name, dataSources, fieldValues }, { hideSecretsOf: plugin.fields })

    return toPreviewData(plugin, rendering, new Date())
  }

  private async sensorsOf(deviceId: string): Promise<DeviceSensor[]> {
    if (!await this.deviceRepository.existsBy({ id: deviceId }))
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })

    return this.deviceSensors.findForDevice(deviceId)
  }
}
