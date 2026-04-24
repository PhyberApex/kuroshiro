import type { CreateMashupDto } from './dto/create-mashup.dto'
import type { UpdateMashupDto } from './dto/update-mashup.dto'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { Plugin } from '../plugins/entities/plugin.entity'
import { Screen } from '../screens/screens.entity'
import { MASHUP_LAYOUT_CONFIG } from './constants/layouts'
import { MashupConfiguration } from './entities/mashup-configuration.entity'
import { MashupSlot } from './entities/mashup-slot.entity'

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

  async create(dto: CreateMashupDto): Promise<Screen> {
    this.logger.log(`Creating mashup for device ${dto.deviceId}`)

    // 1. Validate device exists
    const device = await this.deviceRepository.findOne({
      where: { id: dto.deviceId },
      relations: ['screens'],
    })

    if (!device) {
      this.logger.warn(`Device not found: ${dto.deviceId}`)
      throw new NotFoundException('Device not found')
    }

    // 2. Validate layout → plugin count match
    const layoutConfig = MASHUP_LAYOUT_CONFIG[dto.layout]
    if (!layoutConfig) {
      throw new BadRequestException(`Invalid layout: ${dto.layout}`)
    }

    if (dto.pluginIds.length !== layoutConfig.length) {
      throw new BadRequestException(
        `${dto.layout} requires ${layoutConfig.length} plugins, but ${dto.pluginIds.length} were provided`,
      )
    }

    // 3. Validate unique plugins (no duplicates)
    const uniqueIds = new Set(dto.pluginIds)
    if (uniqueIds.size !== dto.pluginIds.length) {
      throw new BadRequestException('Cannot use the same plugin multiple times')
    }

    // 4. Validate all plugins exist
    const plugins: Plugin[] = []
    for (const pluginId of dto.pluginIds) {
      const plugin = await this.pluginRepository.findOne({ where: { id: pluginId } })
      if (!plugin) {
        throw new NotFoundException(`Plugin ${pluginId} not found`)
      }
      plugins.push(plugin)
    }

    // 5. Create Screen entity
    const maxOrder = device.screens?.length ? Math.max(...device.screens.map(s => s.order)) : 0
    const screen = this.screenRepository.create({
      filename: dto.filename,
      type: 'mashup',
      device,
      order: maxOrder + 1,
      isActive: false,
      generatedAt: new Date(),
      fetchManual: false,
    })
    const savedScreen = await this.screenRepository.save(screen)

    // 6. Create MashupConfiguration
    const config = this.mashupConfigRepository.create({
      layout: dto.layout,
      screen: savedScreen,
    })
    const savedConfig = await this.mashupConfigRepository.save(config)

    // 7. Create MashupSlots
    for (let i = 0; i < dto.pluginIds.length; i++) {
      const slotConfig = layoutConfig[i]
      const slot = this.mashupSlotRepository.create({
        position: slotConfig.position,
        size: slotConfig.size,
        order: slotConfig.order,
        plugin: plugins[i],
        mashupConfiguration: savedConfig,
      })
      await this.mashupSlotRepository.save(slot)
    }

    // 8. Set as active screen
    await this.screenRepository.update({ device: { id: device.id } }, { isActive: false })
    savedScreen.isActive = true
    await this.screenRepository.save(savedScreen)

    this.logger.log(`Mashup created with id: ${savedScreen.id}`)
    return savedScreen
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
        relations: ['slots'],
      })

      if (!config) {
        throw new NotFoundException('Mashup configuration not found')
      }

      const layout = dto.layout || config.layout
      const layoutConfig = MASHUP_LAYOUT_CONFIG[layout]

      if (dto.pluginIds) {
        // Validate plugin count
        if (dto.pluginIds.length !== layoutConfig.length) {
          throw new BadRequestException(
            `${layout} requires ${layoutConfig.length} plugins`,
          )
        }

        // Validate unique plugins
        const uniqueIds = new Set(dto.pluginIds)
        if (uniqueIds.size !== dto.pluginIds.length) {
          throw new BadRequestException('Cannot use the same plugin multiple times')
        }

        // Validate all plugins exist
        const plugins: Plugin[] = []
        for (const pluginId of dto.pluginIds) {
          const plugin = await this.pluginRepository.findOne({ where: { id: pluginId } })
          if (!plugin) {
            throw new NotFoundException(`Plugin ${pluginId} not found`)
          }
          plugins.push(plugin)
        }

        // Remove old slots
        if (config.slots && config.slots.length > 0) {
          await this.mashupSlotRepository.remove(config.slots)
        }

        // Create new slots
        for (let i = 0; i < dto.pluginIds.length; i++) {
          const slotConfig = layoutConfig[i]
          const slot = this.mashupSlotRepository.create({
            position: slotConfig.position,
            size: slotConfig.size,
            order: slotConfig.order,
            plugin: plugins[i],
            mashupConfiguration: config,
          })
          await this.mashupSlotRepository.save(slot)
        }
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
    return this.screenRepository.findOne({ where: { id: screenId } })
  }

  async delete(screenId: string): Promise<void> {
    this.logger.log(`Deleting mashup ${screenId}`)

    const screen = await this.screenRepository.findOne({
      where: { id: screenId, type: 'mashup' },
    })

    if (!screen) {
      throw new NotFoundException('Mashup screen not found')
    }

    const config = await this.mashupConfigRepository.findOne({
      where: { screen: { id: screenId } },
    })

    if (config) {
      await this.mashupConfigRepository.remove(config)
    }

    await this.screenRepository.remove(screen)
    this.logger.log(`Mashup deleted: ${screenId}`)
  }

  async getConfiguration(screenId: string): Promise<MashupConfiguration> {
    const config = await this.mashupConfigRepository.findOne({
      where: { screen: { id: screenId } },
      relations: ['slots', 'slots.plugin'],
    })

    if (!config) {
      throw new NotFoundException('Mashup configuration not found')
    }

    return config
  }

  getLayouts() {
    return MASHUP_LAYOUT_CONFIG
  }
}
