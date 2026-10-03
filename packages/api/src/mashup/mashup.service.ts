import type { SlotConfig } from './constants/layouts.js'
import type { CreateMashupDto } from './dto/create-mashup.dto.js'
import type { UpdateMashupDto } from './dto/update-mashup.dto.js'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { ApiException, ValidationException } from '../errors/api.exception.js'
import { Plugin } from '../plugins/entities/plugin.entity.js'
import { joinEndOfOrder } from '../screens/screen-order.js'
import { Screen } from '../screens/screens.entity.js'
import { MASHUP_LAYOUT_CONFIG } from './constants/layouts.js'
import { MashupConfiguration } from './entities/mashup-configuration.entity.js'
import { MashupSlot } from './entities/mashup-slot.entity.js'

@Injectable()
export class MashupService {
  private readonly logger = new Logger(MashupService.name)

  constructor(
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(MashupConfiguration)
    private readonly mashupConfigRepository: Repository<MashupConfiguration>,
    @InjectRepository(MashupSlot)
    private readonly mashupSlotRepository: Repository<MashupSlot>,
    @InjectRepository(Plugin)
    private readonly pluginRepository: Repository<Plugin>,
  ) {}

  /** Adds a Mashup at the end of the Device's Order and answers its Screen's id. */
  async create(input: CreateMashupDto): Promise<string> {
    this.logger.log(`Creating mashup for device ${input.deviceId}`)
    if (!await this.deviceRepository.existsBy({ id: input.deviceId }))
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: input.deviceId })
    const { layoutConfig, plugins } = await this.resolveLayoutPlugins(input.layout, input.pluginIds)

    const screenId = await this.screenRepository.manager.transaction(async (manager) => {
      const screen = await joinEndOfOrder(manager, input.deviceId, { type: 'mashup', filename: input.name })
      const configuration = await manager.getRepository(MashupConfiguration).save({ layout: input.layout, screen })
      await this.buildSlots(layoutConfig, plugins, configuration, manager.getRepository(MashupSlot))
      return screen.id
    })
    this.logger.log(`Mashup created with id: ${screenId}`)
    return screenId
  }

  /** Replaces a Mashup's whole slot list, under a new layout when one is given, and clears its cached output. */
  async update(screenId: string, input: UpdateMashupDto): Promise<string> {
    this.logger.log(`Updating mashup ${screenId}`)
    const configuration = isUUID(screenId)
      ? await this.mashupConfigRepository.findOne({ where: { screen: { id: screenId, type: 'mashup' } }, relations: { slots: true } })
      : null
    if (!configuration)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id: screenId })

    const layout = input.layout ?? configuration.layout
    const { layoutConfig, plugins } = await this.resolveLayoutPlugins(layout, input.pluginIds)

    await this.screenRepository.manager.transaction(async (manager) => {
      const configurations = manager.getRepository(MashupConfiguration)
      const slots = manager.getRepository(MashupSlot)
      await slots.remove(configuration.slots)
      await configurations.update({ id: configuration.id }, { layout })
      await this.buildSlots(layoutConfig, plugins, configuration, slots)
      await manager.getRepository(Screen).update({ id: screenId }, { cachedPluginOutput: null })
    })
    this.logger.log(`Mashup updated: ${screenId}`)
    return screenId
  }

  private async resolveLayoutPlugins(
    layout: string,
    pluginIds: string[],
  ): Promise<{ layoutConfig: SlotConfig[], plugins: Plugin[] }> {
    const layoutConfig = MASHUP_LAYOUT_CONFIG[layout]
    if (!layoutConfig)
      throw new ValidationException([{ path: 'layout', message: `Invalid layout: ${layout}` }])

    if (pluginIds.length !== layoutConfig.length)
      throw new ValidationException([{ path: 'pluginIds', message: `${layout} requires ${layoutConfig.length} plugins, but ${pluginIds.length} were provided` }])

    if (new Set(pluginIds).size !== pluginIds.length)
      throw new ValidationException([{ path: 'pluginIds', message: 'Cannot use the same plugin multiple times' }])

    const plugins: Plugin[] = []
    for (const pluginId of pluginIds) {
      const plugin = await this.pluginRepository.findOne({ where: { id: pluginId } })
      if (!plugin)
        throw new ApiException(HttpStatus.NOT_FOUND, 'plugin-not-found', `Plugin ${pluginId} not found`, { id: pluginId })
      plugins.push(plugin)
    }

    return { layoutConfig, plugins }
  }

  private async buildSlots(
    layoutConfig: SlotConfig[],
    plugins: Plugin[],
    configuration: MashupConfiguration,
    slots: Repository<MashupSlot> = this.mashupSlotRepository,
  ): Promise<void> {
    for (let i = 0; i < layoutConfig.length; i++) {
      const slotConfig = layoutConfig[i]
      const slot = slots.create({
        position: slotConfig.position,
        size: slotConfig.size,
        order: slotConfig.order,
        plugin: plugins[i],
        mashupConfiguration: configuration,
      })
      await slots.save(slot)
    }
  }
}
