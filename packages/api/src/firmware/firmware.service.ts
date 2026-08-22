import buffer from 'node:buffer'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { fileExists } from '../utils/fileExists'
import { Firmware } from './entities/firmware.entity'
import { firmwareFilePath, firmwareFileUrl } from './firmware-paths'

// ESP32 OTA images from usetrmnl/firmware run well under this; a generous
// ceiling still catches an obviously-wrong upload without inspecting the binary.
export const MAX_FIRMWARE_UPLOAD_BYTES = 8 * 1024 * 1024

export interface UploadFirmwareInput {
  version?: string
  label?: string
  compatibleModels?: string[]
}

@Injectable()
export class FirmwareService {
  private readonly logger = new Logger(FirmwareService.name)

  constructor(
    @InjectRepository(Firmware)
    private readonly firmwareRepository: Repository<Firmware>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * A custom row's uploadedAt and an official-synced row's syncedAt are mutually
   * exclusive, so ordering by either column alone lets Postgres' NULLS-FIRST
   * default on DESC push every row of the other kind above it regardless of
   * actual recency — COALESCE compares them on one shared timeline instead.
   */
  findAll(): Promise<Firmware[]> {
    return this.firmwareRepository
      .createQueryBuilder('firmware')
      .orderBy('COALESCE(firmware.uploadedAt, firmware.syncedAt)', 'DESC')
      .getMany()
  }

  findById(id: string): Promise<Firmware | null> {
    return this.firmwareRepository.findOneBy({ id })
  }

  async upload(file: { buffer: buffer.Buffer, originalname: string, mimetype: string, size: number }, input: UploadFirmwareInput): Promise<Firmware> {
    if (!input.version)
      throw new BadRequestException('Firmware version is required')
    if (file.size > MAX_FIRMWARE_UPLOAD_BYTES)
      throw new BadRequestException(`Firmware upload exceeds the ${MAX_FIRMWARE_UPLOAD_BYTES / (1024 * 1024)}MB limit`)
    if (path.extname(file.originalname).toLowerCase() !== '.bin')
      throw new BadRequestException('Firmware upload must be a .bin file')

    const id = crypto.randomUUID()
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex')
    await fs.promises.mkdir(path.dirname(this.filePath(id)), { recursive: true })
    await fs.promises.writeFile(this.filePath(id), file.buffer)

    const firmware = this.firmwareRepository.create({
      id,
      version: input.version,
      kind: 'custom',
      checksum,
      compatibleModels: input.compatibleModels ?? [],
      deprecated: false,
      label: input.label ?? file.originalname,
      uploadedAt: new Date(),
    })
    const saved = await this.firmwareRepository.save(firmware)
    this.logger.log(`Uploaded custom firmware ${saved.id} (${saved.version})`)
    return saved
  }

  async delete(id: string): Promise<void> {
    const firmware = await this.firmwareRepository.findOneBy({ id })
    if (!firmware)
      throw new NotFoundException(`Firmware ${id} not found`)
    if (firmware.kind !== 'custom')
      throw new BadRequestException('Only custom firmware can be deleted')
    await this.firmwareRepository.remove(firmware)
    await fs.promises.unlink(this.filePath(id)).catch(() => {})
    this.logger.log(`Deleted custom firmware ${id}`)
  }

  /** Recomputes the on-disk binary's checksum and compares it against the recorded one, so a corrupted file is never served. */
  async verifyChecksum(firmware: Firmware): Promise<boolean> {
    const filePath = this.filePath(firmware.id)
    if (!await fileExists(filePath)) {
      this.logger.warn(`Firmware ${firmware.id} (${firmware.version}) is missing its binary on disk at ${filePath}`)
      return false
    }
    const buffer = await fs.promises.readFile(filePath)
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex')
    return checksum === firmware.checksum
  }

  filePath(id: string): string {
    return firmwareFilePath(id)
  }

  fileUrl(id: string): string {
    return firmwareFileUrl(id, this.configService.get<string>('api_url', 'http://localhost:5173'))
  }
}
