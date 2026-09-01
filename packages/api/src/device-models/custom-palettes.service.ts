import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CreateCustomPaletteDto } from './dto/create-custom-palette.dto.js'
import { CUSTOM_PALETTE_FRAMEWORK_CLASSES, Palette } from './entities/palette.entity.js'
import { HEX_COLOR_PATTERN } from './trmnl-payloads.js'

@Injectable()
export class CustomPalettesService {
  constructor(
    @InjectRepository(Palette)
    private readonly paletteRepository: Repository<Palette>,
  ) {}

  /**
   * IDs are generated (never derived from `name`) so a custom row can never
   * collide with a future TRMNL-introduced palette id, which sync upserts by.
   */
  async create(dto: CreateCustomPaletteDto): Promise<Palette> {
    this.assertValid(dto)
    const palette = this.paletteRepository.create({
      id: randomUUID(),
      name: dto.name,
      kind: 'custom',
      grays: 2,
      colors: dto.colors,
      frameworkClass: dto.frameworkClass,
      grayscaleBitDepth: null,
      deprecated: false,
      syncedAt: null,
    })
    return this.paletteRepository.save(palette)
  }

  async delete(id: string): Promise<void> {
    const palette = await this.paletteRepository.findOneBy({ id })
    if (!palette)
      throw new NotFoundException(`Palette ${id} not found`)
    if (palette.kind !== 'custom')
      throw new BadRequestException(`Palette ${id} is not a custom palette and cannot be deleted`)
    await this.paletteRepository.remove(palette)
  }

  private assertValid(dto: CreateCustomPaletteDto): void {
    if (!dto.name?.trim())
      throw new BadRequestException('name is required')
    if (!CUSTOM_PALETTE_FRAMEWORK_CLASSES.includes(dto.frameworkClass))
      throw new BadRequestException(`frameworkClass must be one of: ${CUSTOM_PALETTE_FRAMEWORK_CLASSES.join(', ')}`)
    if (!Array.isArray(dto.colors) || dto.colors.length === 0 || dto.colors.some(c => !HEX_COLOR_PATTERN.test(c)))
      throw new BadRequestException('colors must be a non-empty array of #RRGGBB hex values')
  }
}
