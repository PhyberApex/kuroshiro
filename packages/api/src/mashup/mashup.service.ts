import type { SlotConfig } from './constants/layouts.js'
import type { CreateMashupDto } from './dto/create-mashup.dto.js'
import type { UpdateMashupDto } from './dto/update-mashup.dto.js'
import { BadRequestException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
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

  async update(screenId: string, dto: UpdateMashupDto): Promise<Screen> {
    this.logger.log(`Updating mashup ${screenId}`)

    // 1. Find screen
    const screen = await this.screenRepository.findOne({
      where: { id: screenId, type: 'mashup' },
    })

    if (!screen) {
      throw new NotFoundException('Mashup screen not found')
    }

    // 2. Update screen filename if provided
    if (dto.filename) {
      screen.filename = dto.filename
      await this.screenRepository.save(screen)
    }

    // 3. If layout or plugins changed, update configuration
    if (dto.layout || dto.pluginIds) {
      const config = await this.mashupConfigRepository.findOne({
        where: { screen: { id: screenId } },
        relations: { slots: true },
      })

      if (!config) {
        throw new NotFoundException('Mashup configuration not found')
      }

      const layout = dto.layout || config.layout

      if (dto.pluginIds) {
        const { layoutConfig, plugins } = await this.resolveLayoutPlugins(layout, dto.pluginIds)

        // Remove old slots
        if (config.slots && config.slots.length > 0) {
          await this.mashupSlotRepository.remove(config.slots)
        }

        // Create new slots
        await this.buildSlots(layoutConfig, plugins, config)
      }

      // Update layout if changed
      if (dto.layout) {
        config.layout = dto.layout
        await this.mashupConfigRepository.save(config)
      }

      // Clear cache to trigger re-render
      await this.screenRepository.update({ id: screenId }, { cachedPluginOutput: null })
    }

    this.logger.log(`Mashup updated: ${screenId}`)
    const updated = await this.screenRepository.findOne({ where: { id: screenId } })
    if (!updated)
      throw new NotFoundException('Mashup screen not found')
    return updated
  }

  async getConfiguration(screenId: string): Promise<MashupConfiguration> {
    const config = await this.mashupConfigRepository.findOne({
      where: { screen: { id: screenId } },
      relations: { slots: { plugin: true } },
    })

    if (!config) {
      throw new NotFoundException('Mashup configuration not found')
    }

    return config
  }

  getLayouts() {
    return MASHUP_LAYOUT_CONFIG
  }

  private async resolveLayoutPlugins(
    layout: string,
    pluginIds: string[],
  ): Promise<{ layoutConfig: SlotConfig[], plugins: Plugin[] }> {
    const layoutConfig = MASHUP_LAYOUT_CONFIG[layout]
    if (!layoutConfig) {
      throw new BadRequestException(`Invalid layout: ${layout}`)
    }

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
