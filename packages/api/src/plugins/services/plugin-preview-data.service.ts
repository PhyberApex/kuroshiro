import type { PreviewData } from 'kuroshiro-shared'
import type { PreviewDataDto } from '../dto/preview-data.dto.js'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../../device-models/device-models.service.js'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import { Device } from '../../devices/devices.entity.js'
import { ApiException } from '../../errors/api.exception.js'
import { Plugin } from '../entities/plugin.entity.js'
import { toPreviewData } from '../plugin.mapper.js'
import { withTrmnlDevice } from '../trmnl-device.js'
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
    private readonly deviceModels: DeviceModelsService,
  ) {}

  async previewData(pluginId: string, { deviceId, name, dataSources, fieldValues }: PreviewDataDto): Promise<PreviewData> {
    const plugin = isUUID(pluginId)
      ? await this.pluginRepository.findOne({ where: { id: pluginId }, relations: { dataSources: true, fields: true }, order: { dataSources: { order: 'ASC' } } })
      : null
    if (!plugin)
      throw new ApiException(HttpStatus.NOT_FOUND, 'plugin-not-found', 'Plugin not found', { id: pluginId })

    const device = deviceId ? await this.deviceOf(deviceId) : null
    const sensors = device ? await this.deviceSensors.findForDevice(device.id) : []
    const rendering = await this.templateContext.contextFor(plugin, sensors, { name, dataSources, fieldValues }, { hideSecretsOf: plugin.fields })

    return toPreviewData(plugin, device ? { ...rendering, context: await withTrmnlDevice(rendering.context, device, this.deviceModels) } : rendering, new Date())
  }

  private async deviceOf(deviceId: string): Promise<Device> {
    const device = await this.deviceRepository.findOneBy({ id: deviceId })
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })
    return device
  }
}
