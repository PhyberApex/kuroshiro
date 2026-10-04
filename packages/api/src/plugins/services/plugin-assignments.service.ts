import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { EntityManager, Repository } from 'typeorm'
import { Device } from '../../devices/devices.entity.js'
import { ApiException } from '../../errors/api.exception.js'
import { closeGapInOrder, joinEndOfOrder } from '../../screens/screen-order.js'
import { Screen } from '../../screens/screens.entity.js'
import { DevicePlugin } from '../entities/device-plugin.entity.js'
import { Plugin } from '../entities/plugin.entity.js'

@Injectable()
export class PluginAssignmentsService {
  constructor(
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(DevicePlugin)
    private readonly devicePluginRepository: Repository<DevicePlugin>,
  ) {}

  /** The same service reading and writing inside the transaction `manager` runs. */
  within(manager: EntityManager): PluginAssignmentsService {
    return new PluginAssignmentsService(manager.getRepository(Plugin), manager.getRepository(Device), manager.getRepository(DevicePlugin))
  }

  /** Puts the Plugin on the Device as a Plugin Screen at the end of its Order and answers that Screen's id. */
  async assign(pluginId: string, deviceId: string): Promise<string> {
    if (!isUUID(pluginId) || !await this.pluginRepository.existsBy({ id: pluginId }))
      throw new ApiException(HttpStatus.NOT_FOUND, 'plugin-not-found', 'Plugin not found', { id: pluginId })
    if (!isUUID(deviceId) || !await this.deviceRepository.existsBy({ id: deviceId }))
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })
    if (await this.findAssignment(pluginId, deviceId))
      throw new ApiException(HttpStatus.CONFLICT, 'plugin-already-assigned', 'The Plugin is already assigned to this Device.', { pluginId, deviceId })

    return this.devicePluginRepository.manager.transaction(async (manager) => {
      const assignment = await manager.getRepository(DevicePlugin).save({ plugin: { id: pluginId }, device: { id: deviceId } })
      const screen = await joinEndOfOrder(manager, deviceId, { type: 'plugin', plugin: { id: pluginId }, devicePluginId: assignment.id })
      return screen.id
    })
  }

  async unassign(pluginId: string, deviceId: string): Promise<void> {
    const assignment = isUUID(pluginId) && isUUID(deviceId) ? await this.findAssignment(pluginId, deviceId) : null
    if (!assignment)
      throw new ApiException(HttpStatus.NOT_FOUND, 'assignment-not-found', 'The Plugin is not assigned to this Device.', { pluginId, deviceId })

    await this.devicePluginRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Screen).delete({ devicePluginId: assignment.id })
      await manager.getRepository(DevicePlugin).delete(assignment.id)
      await closeGapInOrder(manager, deviceId)
    })
  }

  private findAssignment(pluginId: string, deviceId: string): Promise<DevicePlugin | null> {
    return this.devicePluginRepository.findOne({ where: { plugin: { id: pluginId }, device: { id: deviceId } } })
  }
}
