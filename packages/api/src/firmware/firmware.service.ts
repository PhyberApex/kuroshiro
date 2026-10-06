import type { UploadFirmwareInput } from 'kuroshiro-shared'
import buffer from 'node:buffer'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { DeviceModel } from '../device-models/entities/device-model.entity.js'
import { Device } from '../devices/devices.entity.js'
import { ApiException } from '../errors/api.exception.js'
import { isUniqueViolation } from '../errors/unique-violation.js'
import { uploadTooLarge } from '../uploads/limited-file-interceptor.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { fileExists } from '../utils/fileExists.js'
import { Firmware } from './entities/firmware.entity.js'
import { firmwareFilePath, firmwareFileUrl } from './firmware-paths.js'

@Injectable()
export class FirmwareService {
  private readonly logger = new Logger(FirmwareService.name)

  constructor(
    @InjectRepository(Firmware)
    private readonly firmwareRepository: Repository<Firmware>,
    @InjectRepository(DeviceModel)
    private readonly deviceModelRepository: Repository<DeviceModel>,
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
    if (file.size > UPLOAD_LIMITS.firmwareUploadBytes)
      throw uploadTooLarge(UPLOAD_LIMITS.firmwareUploadBytes)
    if (path.extname(file.originalname).toLowerCase() !== '.bin')
      throw new BadRequestException('Firmware upload must be a .bin file')
    const compatibleModels = input.compatibleModels ?? []
    await this.assertVersionFree(input.version)
    await this.assertDeviceModelsKnown(compatibleModels)

    const id = crypto.randomUUID()
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex')
    await fs.promises.mkdir(path.dirname(this.filePath(id)), { recursive: true })
    await fs.promises.writeFile(this.filePath(id), file.buffer)

    const firmware = this.firmwareRepository.create({
      id,
      version: input.version,
      kind: 'custom',
      checksum,
      compatibleModels,
      deprecated: false,
      label: input.label ?? file.originalname,
      uploadedAt: new Date(),
    })
    let saved: Firmware
    try {
      saved = await this.firmwareRepository.save(firmware)
    }
    catch (err) {
      await fs.promises.unlink(this.filePath(id)).catch(() => {})
      if (!isUniqueViolation(err, 'UQ_firmware_version'))
        throw err
      throw new ApiException(409, 'firmware-version-taken', `There is already a Firmware ${input.version}.`, { version: input.version })
    }
    this.logger.log(`Uploaded custom firmware ${saved.id} (${saved.version})`)
    return saved
  }

  private async assertVersionFree(version: string): Promise<void> {
    if (await this.firmwareRepository.existsBy({ version }))
      throw new ApiException(409, 'firmware-version-taken', `There is already a Firmware ${version}.`, { version })
  }

  private async assertDeviceModelsKnown(names: string[]): Promise<void> {
    if (names.length === 0)
      return
    const known = new Set((await this.deviceModelRepository.find({ select: { name: true }, where: { name: In(names) } })).map(model => model.name))
    const unknown = names.filter(name => !known.has(name))
    if (unknown.length > 0)
      throw new ApiException(400, 'device-model-unknown', `This Instance does not know the Device Model ${unknown.join(', ')}.`, { names: unknown })
  }

  /** Every Device that targets the Firmware loses the target and the push pending for it, in the same transaction that removes the row. */
  async delete(id: string): Promise<void> {
    const firmware = await this.firmwareRepository.findOneBy({ id })
    if (!firmware)
      throw new NotFoundException(`Firmware ${id} not found`)
    if (firmware.kind !== 'custom')
      throw new ApiException(400, 'firmware-not-custom', 'Only a custom Firmware can be deleted.')
    await this.firmwareRepository.manager.transaction(async (manager) => {
      await manager.createQueryBuilder().update(Device).set({ targetFirmware: null, updateFirmware: false }).where('"targetFirmwareId" = :id', { id }).execute()
      await manager.delete(Firmware, { id })
    })
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
