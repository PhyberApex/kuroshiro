import type { CreateCustomPaletteInput, UpdateCustomPaletteInput } from 'kuroshiro-shared'
import { randomUUID } from 'node:crypto'
import { HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ILike, Not, Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { ApiException } from '../errors/api.exception.js'
import { isUniqueViolation } from '../errors/unique-violation.js'
import { ScreensService } from '../screens/screens.service.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { DeviceModelsService } from './device-models.service.js'
import { Palette } from './entities/palette.entity.js'

/** `ILike` treats these as wildcards; a name is compared as it is. */
function literally(name: string): string {
  return name.replace(/[\\%_]/g, '\\$&')
}

@Injectable()
export class CustomPalettesService {
  private readonly logger = new Logger(CustomPalettesService.name)

  constructor(
    @InjectRepository(Palette)
    private readonly paletteRepository: Repository<Palette>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly deviceModels: DeviceModelsService,
    private readonly screens: ScreensService,
  ) {}

  /**
   * IDs are generated (never derived from `name`) so a custom row can never
   * collide with a future TRMNL-introduced palette id, which sync upserts by.
   */
  async create(input: CreateCustomPaletteInput): Promise<string> {
    await this.assertNameFree(input.name)
    const palette = this.paletteRepository.create({
      id: randomUUID(),
      name: input.name,
      kind: 'custom',
      grays: 2,
      colors: input.colors,
      frameworkClass: input.frameworkClass,
      grayscaleBitDepth: null,
      deprecated: false,
      syncedAt: null,
    })
    try {
      return (await this.paletteRepository.save(palette)).id
    }
    catch (err) {
      throw this.asNameTaken(err, input.name)
    }
  }

  /** Changes a custom Palette, then converts the stored images of every Device using it again. */
  async update(id: string, changes: UpdateCustomPaletteInput): Promise<void> {
    const palette = await this.findCustom(id)
    if (changes.name !== undefined)
      await this.assertNameFree(changes.name, id)
    const users = await this.devicesUsing(id)
    if (changes.frameworkClass !== undefined && changes.frameworkClass !== palette.frameworkClass && users.length > 0) {
      throw new ApiException(HttpStatus.CONFLICT, 'palette-in-use', 'The Palette Family cannot be changed while a Device uses the Palette.', {
        usedBy: users.map(({ id: deviceId, name }) => ({ id: deviceId, name })),
      })
    }
    try {
      await this.paletteRepository.save(Object.assign(palette, changes))
    }
    catch (err) {
      throw this.asNameTaken(err, changes.name ?? palette.name)
    }
    // Read again: the Devices loaded before the save carry the Palette as it was, and the conversion reads its colours off the Device.
    await this.reconvert(await this.devicesUsing(id))
  }

  /** Gives each Device using it its Device Model's default Palette, deletes it, then converts those Devices' stored images again. */
  async delete(id: string): Promise<void> {
    const palette = await this.findCustom(id)
    const users = await this.devicesUsing(id)
    await this.paletteRepository.manager.transaction(async (manager) => {
      for (const device of users) {
        device.palette = device.deviceModel ? await this.deviceModels.defaultPaletteFor(device.deviceModel) : null
        await manager.save(device)
      }
      await manager.remove(palette)
    })
    await this.reconvert(users)
  }

  private async findCustom(id: string): Promise<Palette> {
    const palette = await this.paletteRepository.findOneBy({ id })
    if (!palette)
      throw new NotFoundException(`Palette ${id} not found`)
    if (palette.kind !== 'custom')
      throw new ApiException(HttpStatus.BAD_REQUEST, 'palette-not-custom', `Palette ${id} is one of TRMNL's and cannot be changed or deleted.`, { id })
    return palette
  }

  private async assertNameFree(name: string, ownId?: string): Promise<void> {
    const taken = await this.paletteRepository.existsBy({ kind: 'custom', name: ILike(literally(name)), ...(ownId ? { id: Not(ownId) } : {}) })
    if (taken)
      throw this.nameTaken(name)
  }

  /** A race against `assertNameFree`'s check, caught on the write it lost: anything else is rethrown as it was. */
  private asNameTaken(err: unknown, name: string): unknown {
    return isUniqueViolation(err, 'UQ_palette_custom_name') ? this.nameTaken(name) : err
  }

  private nameTaken(name: string): ApiException {
    return new ApiException(HttpStatus.CONFLICT, 'palette-name-taken', 'There is already a custom Palette with that name.', { name })
  }

  private devicesUsing(paletteId: string): Promise<Device[]> {
    return this.deviceRepository.find({ where: { palette: { id: paletteId } }, order: { name: 'ASC' } })
  }

  /** A failed conversion leaves the image as it was; the Palette change stands, as a Device's own Palette change does. */
  private async reconvert(devices: Device[]): Promise<void> {
    for (const device of devices) {
      await this.screens.reconvertImageScreens(device).catch((error: unknown) =>
        this.logger.error(`Could not convert the images of Device ${device.id} again: ${getErrorMessage(error)}`))
    }
  }
}
