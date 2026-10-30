import type { ApiErrorCode } from 'kuroshiro-shared'
import type { Buffer } from 'node:buffer'
import type { DeepPartial } from 'typeorm'
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js'
import type { DeviceRenderTarget } from '../device-models/device-models.service.js'
import type { StagedImagePaths } from '../utils/stagedImageUpload.js'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../device-models/device-models.service.js'
import { Device } from '../devices/devices.entity.js'
import { ApiException, ValidationException } from '../errors/api.exception.js'
import { DevicePlugin } from '../plugins/entities/device-plugin.entity.js'
import { fileExists } from '../utils/fileExists.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'
import { convertToPng, downloadImage, readImageSize } from '../utils/imageUtils.js'
import { resolveAppPath } from '../utils/pathHelper.js'
import { assertPublicUrl, requesterFor } from '../utils/ssrfGuard.js'
import { assertUploadAllowed, deleteFileIfExists, refusingUnreadableImage, stageUpload, writeUpload } from '../utils/stagedImageUpload.js'
import { CreateScreenDto } from './dto/create-screen.dto.js'
import { UpdateScreenDto } from './dto/update-screen.dto.js'
import { closeGapInOrder, joinEndOfOrder, writeOrder } from './screen-order.js'
import { Screen } from './screens.entity.js'

type FileFacts = Pick<Screen, 'fileOriginalName' | 'fileWidth' | 'fileHeight' | 'fileBytes' | 'fileUploadedAt'>

const EDITABLE_FIELDS: Record<Screen['type'], ReadonlyArray<keyof UpdateScreenDto>> = {
  external: ['name', 'url', 'fetchManual', 'dither'],
  file: ['name', 'dither'],
  html: ['name', 'html', 'dither'],
  mashup: ['name'],
  plugin: [],
}

@Injectable()
export class ScreensService {
  private readonly logger = new Logger(ScreensService.name)
  constructor(
    @InjectRepository(Screen)
    private screensRepository: Repository<Screen>,
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
    private readonly configService: ConfigService,
    private readonly deviceModels: DeviceModelsService,
  ) {}

  /** Adds an External link, File or HTML Screen at the end of the Device's Order and answers its id. */
  async add(input: CreateScreenDto, file?: Express.Multer.File): Promise<string> {
    this.logger.log(`Adding ${input.kind} screen to device ${input.deviceId}`)
    this.assertFileMatchesKind(input, file)
    const device = await this.devicesRepository.findOneBy({ id: input.deviceId })
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: input.deviceId })

    const id = randomUUID()
    const dither = input.dither ?? true
    const content = await this.prepareContent(input, device, id, dither, file)
    try {
      await joinEndOfOrder(this.screensRepository.manager, device.id, { id, type: input.kind, filename: input.name, dither, ...content })
    }
    catch (err) {
      await this.deleteImages(device.id, id)
      throw err
    }
    this.logger.log(`Screen created with id: ${id} for device: ${device.id}`)
    return id
  }

  private assertFileMatchesKind(input: CreateScreenDto, file?: Express.Multer.File): void {
    if (input.kind !== 'file') {
      if (file)
        throw new ValidationException([{ path: 'file', message: 'Only a File Screen takes a file.' }])
      return
    }
    assertUploadAllowed(this.configService, file, 'A File Screen needs a file.')
  }

  /** The kind's own columns, with its image stored under the given Screen id when the kind keeps one. */
  private async prepareContent(input: CreateScreenDto, device: Device, screenId: string, dither: boolean, file?: Express.Multer.File): Promise<DeepPartial<Screen>> {
    switch (input.kind) {
      case 'html':
        return { html: input.html }
      case 'external':
        if (input.fetchManual)
          await this.stageImage(device, screenId).store(staged => this.fetchKeptImage(device, input.url!, staged, dither))
        return { externalLink: input.url, fetchManual: input.fetchManual }
      case 'file':
        return this.stageImage(device, screenId).store(staged => this.convertUpload(device, file!, staged, dither))
    }
  }

  /** Changes the fields of a Screen that belong to its kind; the Order and the Active Screen stay as they are. */
  async update(id: string, input: UpdateScreenDto): Promise<string> {
    this.logger.log(`Updating screen ${id}`)
    const screen = await this.findScreenWithDevice(id)
    this.assertFieldsBelongToKind(screen, input)

    const changes: QueryDeepPartialEntity<Screen> = {
      ...(input.name !== undefined && { filename: input.name }),
      ...(input.html !== undefined && { html: input.html, renderSignal: null }),
      ...(input.dither !== undefined && { dither: input.dither }),
      ...(screen.type === 'external' && await this.changeExternalLink(screen, input)),
      ...(this.changesHtmlImage(screen, input) && { generatedAt: new Date() }),
    }
    if (Object.keys(changes).length > 0)
      await this.screensRepository.update({ id }, changes)
    await this.reconvertForDither(screen, input, changes)
    return id
  }

  /** Whether the edit changes what an HTML Screen renders to, so its image goes out under a new filename and the Device draws it (ADR-0031). */
  private changesHtmlImage(screen: Screen, input: UpdateScreenDto): boolean {
    return screen.type === 'html'
      && ((input.html !== undefined && input.html !== screen.html) || (input.dither !== undefined && input.dither !== screen.dither))
  }

  /** A flip of Dithering converts a File Screen's stored image, or an External link's kept one, again from its retained original, unless the change fetched a new one. */
  private async reconvertForDither(screen: Screen, input: UpdateScreenDto, changes: QueryDeepPartialEntity<Screen>): Promise<void> {
    const kept = screen.type === 'file' || (screen.type === 'external' && (changes.fetchManual ?? screen.fetchManual))
    if (input.dither === undefined || input.dither === screen.dither || changes.generatedAt || !kept)
      return
    await this.reconvertScreen(screen.device, await this.deviceModels.renderTargetFor(screen.device), { ...screen, dither: input.dither })
  }

  /** The columns of an External link's own fields, its kept image fetched first when the URL or the choice to keep it changed. */
  private async changeExternalLink(screen: Screen, input: UpdateScreenDto): Promise<QueryDeepPartialEntity<Screen>> {
    const url = input.url ?? screen.externalLink!
    const fetchManual = input.fetchManual ?? screen.fetchManual
    const needsFetch = fetchManual && (url !== screen.externalLink || !screen.fetchManual)
    if (needsFetch)
      await this.stageImage(screen.device, screen.id).store(staged => this.fetchKeptImage(screen.device, url, staged, input.dither ?? screen.dither))
    return { externalLink: url, fetchManual, ...(needsFetch && { generatedAt: new Date() }) }
  }

  private assertFieldsBelongToKind(screen: Screen, input: UpdateScreenDto): void {
    const allowed = EDITABLE_FIELDS[screen.type]
    const misplaced = (Object.keys(input) as Array<keyof UpdateScreenDto>).filter(field => input[field] !== undefined && !allowed.includes(field))
    if (misplaced.length > 0)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'screen-field-not-for-kind', `A ${screen.type} Screen has no ${misplaced.join(', ')}.`, { fields: misplaced })
  }

  /** The image `file` would become for the Screen's Device, as PNG bytes; nothing of the Screen changes. */
  async previewImage(id: string, file?: Express.Multer.File): Promise<Buffer> {
    const screen = await this.findFileScreen(id, file)
    const staged = this.stageImage(screen.device, randomUUID())
    try {
      await this.convertUpload(screen.device, file!, staged, screen.dither)
      return await fs.promises.readFile(staged.imagePath)
    }
    finally {
      await staged.discard()
    }
  }

  /** Swaps a File Screen's image for `file`, keeping its name, Order and Schedule, once the new image converted. */
  async replaceImage(id: string, file?: Express.Multer.File): Promise<string> {
    this.logger.log(`Replacing the image of screen ${id}`)
    const screen = await this.findFileScreen(id, file)
    const facts = await this.stageImage(screen.device, id).store(staged => this.convertUpload(screen.device, file!, staged, screen.dither))
    await this.screensRepository.update({ id }, { ...facts, generatedAt: new Date() })
    return id
  }

  private async findFileScreen(id: string, file?: Express.Multer.File): Promise<Screen> {
    const screen = await this.findScreenWithDevice(id)
    if (screen.type !== 'file')
      throw new ApiException(HttpStatus.BAD_REQUEST, 'screen-field-not-for-kind', 'Only a File Screen has an image to replace.')
    assertUploadAllowed(this.configService, file, 'A File Screen needs a file.')
    return screen
  }

  /** Where an image is written before it replaces the stored one, so a failed fetch or conversion leaves the stored one alone. */
  private stageImage(device: Device, screenId: string) {
    return stageUpload(this.originalImagePath(device.id, screenId), this.screenImagePath(device.id, screenId), this.logger)
  }

  private async fetchKeptImage(device: Device, url: string, staged: StagedImagePaths, dither: boolean): Promise<void> {
    const demoMode = this.configService.get<boolean>('demo_mode')
    if (demoMode)
      assertPublicUrl(url)
    const target = await this.deviceModels.renderTargetFor(device)
    try {
      await downloadImage(url, staged.originalPath, this.logger, requesterFor(demoMode))
    }
    catch (err) {
      const reason = getErrorMessage(err)
      throw this.refuseImage(err, HttpStatus.UNPROCESSABLE_ENTITY, 'image-fetch-failed', `The image could not be fetched: ${reason}`, { reason })
    }
    try {
      await convertToPng(staged.originalPath, staged.imagePath, target, this.logger, { dither })
    }
    catch (err) {
      const reason = 'The address did not answer with an image Kuroshiro can read.'
      throw this.refuseImage(err, HttpStatus.UNPROCESSABLE_ENTITY, 'image-fetch-failed', reason, { reason })
    }
  }

  private async convertUpload(device: Device, file: Express.Multer.File, staged: StagedImagePaths, dither: boolean): Promise<FileFacts> {
    const target = await this.deviceModels.renderTargetFor(device)
    await writeUpload(staged.originalPath, file)
    return refusingUnreadableImage(this.logger, async () => {
      const { width, height } = await readImageSize(staged.originalPath, this.logger)
      await convertToPng(staged.originalPath, staged.imagePath, target, this.logger, { dither })
      return { fileOriginalName: file.originalname, fileWidth: width, fileHeight: height, fileBytes: file.size, fileUploadedAt: new Date() }
    })
  }

  /** Builds the refusal of an image; the cause goes to the log, not to the client. */
  private refuseImage(cause: unknown, status: HttpStatus, code: ApiErrorCode, message: string, details?: Record<string, unknown>): ApiException {
    this.logger.error(`Refusing an image (${code}): ${getErrorMessage(cause)}`)
    return new ApiException(status, code, message, details)
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting screen ${id}`)
    const screen = await this.findScreenWithDevice(id)
    const deviceId = screen.device.id
    await this.deleteImages(deviceId, id)
    await this.screensRepository.manager.transaction(async (manager) => {
      await manager.getRepository(Screen).delete(id)
      if (screen.devicePluginId)
        await manager.getRepository(DevicePlugin).delete(screen.devicePluginId)
      await closeGapInOrder(manager, deviceId)
    })
    this.logger.log(`Screen deleted: ${id}`)
  }

  /** Puts a Device's Screens in the given Order, which has to name each of them once. */
  async reorder(deviceId: string, screenIds: string[]): Promise<void> {
    this.logger.log(`Reordering screens for device ${deviceId}`)
    const device = isUUID(deviceId) ? await this.devicesRepository.findOneBy({ id: deviceId }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })

    const screens = await this.screensRepository.find({ where: { device: { id: deviceId } } })
    const screensById = new Map(screens.map(screen => [screen.id, screen]))
    const ordered = screenIds.flatMap(screenId => screensById.get(screenId) ?? [])
    if (new Set(screenIds).size !== screenIds.length || screens.length !== screenIds.length || ordered.length !== screens.length)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'order-not-a-permutation', 'screenIds must name each of the Device\'s Screens exactly once.')

    await this.screensRepository.manager.transaction(manager => writeOrder(manager, ordered))
    this.logger.log(`Reordered screens for device ${deviceId}`)
  }

  /** Fetches a kept External link's image again; the earlier image stays when the fetch fails. */
  async refresh(id: string): Promise<string> {
    this.logger.log(`Refetching screen: ${id}`)
    const screen = await this.findScreenWithDevice(id)
    if (screen.type !== 'external' || !screen.fetchManual)
      throw new BadRequestException('Only an External link that keeps its image can be refreshed.')
    await this.stageImage(screen.device, id).store(staged => this.fetchKeptImage(screen.device, screen.externalLink!, staged, screen.dither))
    await this.screensRepository.update({ id }, { generatedAt: new Date() })
    return id
  }

  /**
   * Regenerates every stored image of a device (uploads and cached external
   * images) for its current model and palette, from the retained original
   * where one exists and from the previous PNG otherwise.
   */
  async reconvertImageScreens(device: Device): Promise<number> {
    const screens = await this.screensRepository.find({ where: { device: { id: device.id } } })
    const target = await this.deviceModels.renderTargetFor(device)
    let converted = 0
    for (const screen of screens.filter(s => s.type === 'file' || (s.type === 'external' && s.fetchManual))) {
      if (await this.reconvertScreen(device, target, screen))
        converted++
    }
    this.logger.log(`Reconverted ${converted} image screen(s) for device ${device.id} as ${target.model.name}/${target.palette.id}`)
    return converted
  }

  /** Converts one Screen's image again for the target, with the Screen's own Dithering; `false` when there was nothing to convert or it failed. */
  private async reconvertScreen(device: Device, target: DeviceRenderTarget, screen: Screen): Promise<boolean> {
    const outputPath = this.screenImagePath(device.id, screen.id)
    const originalPath = this.originalImagePath(device.id, screen.id)
    const sourcePath = await fileExists(originalPath) ? originalPath : outputPath
    if (!await fileExists(sourcePath)) {
      this.logger.warn(`No image to reconvert for screen ${screen.id}`)
      return false
    }
    const tempPath = path.join(path.dirname(outputPath), `tmp-${screen.id}.png`)
    try {
      await convertToPng(sourcePath, tempPath, target, this.logger, { dither: screen.dither })
      await fs.promises.rename(tempPath, outputPath)
      await this.screensRepository.update({ id: screen.id }, { generatedAt: new Date() })
      return true
    }
    catch (err) {
      this.logger.error(`Failed to reconvert screen ${screen.id}: ${getErrorMessage(err)}`)
      await fs.promises.unlink(tempPath).catch(() => {})
      return false
    }
  }

  private async findScreenWithDevice(id: string): Promise<Screen> {
    const screen = isUUID(id) ? await this.screensRepository.findOne({ where: { id }, relations: { device: true } }) : null
    if (!screen)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id })
    return screen
  }

  private async deleteImages(deviceId: string, screenId: string): Promise<void> {
    await deleteFileIfExists(this.screenImagePath(deviceId, screenId), this.logger)
    await deleteFileIfExists(this.originalImagePath(deviceId, screenId), this.logger)
  }

  private screenImagePath(deviceId: string, screenId: string): string {
    return resolveAppPath('public', 'screens', 'devices', deviceId, `${screenId}.png`)
  }

  private originalImagePath(deviceId: string, screenId: string): string {
    return resolveAppPath('public', 'screens', 'devices', deviceId, `${screenId}.original`)
  }
}
