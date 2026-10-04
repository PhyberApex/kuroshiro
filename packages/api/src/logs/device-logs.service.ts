import type { DeviceLogPage, DeviceLogsQuery, LogLevel } from 'kuroshiro-shared'
import type { SelectQueryBuilder } from 'typeorm'
import type { LogPosition } from './device-log-cursor.js'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { DEVICE_LOG_PAGE_SIZE } from 'kuroshiro-shared'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { ApiException, ValidationException } from '../errors/api.exception.js'
import { decodeCursor, encodeCursor } from './device-log-cursor.js'
import { toDeviceLogEntry } from './device-log.mapper.js'
import { LogEntry } from './logs.entity.js'

const PROBLEM_LEVELS: LogLevel[] = ['error', 'warning']

type CursorKey = 'before' | 'after'
type EntryQuery = SelectQueryBuilder<LogEntry>

function positionOf(query: DeviceLogsQuery, key: CursorKey): LogPosition | null {
  const cursor = query[key]
  if (cursor === undefined)
    return null
  const position = decodeCursor(cursor)
  if (!position)
    throw new ValidationException([{ path: key, message: `${key} must be a cursor this endpoint answered` }])
  return position
}

function containing(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`
}

function newestFirst(entries: EntryQuery): EntryQuery {
  return entries.orderBy('entry.date', 'DESC').addOrderBy('entry.id', 'DESC')
}

@Injectable()
export class DeviceLogsService {
  private readonly logger = new Logger(DeviceLogsService.name)

  constructor(
    @InjectRepository(LogEntry)
    private readonly entryRepository: Repository<LogEntry>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async page(deviceId: string, query: DeviceLogsQuery): Promise<DeviceLogPage> {
    const before = positionOf(query, 'before')
    const after = positionOf(query, 'after')
    await this.requireDevice(deviceId)

    const limit = query.limit ?? DEVICE_LOG_PAGE_SIZE
    const matching = this.matching(deviceId, query, after)
    const [total, matchingCount, newest, found] = await Promise.all([
      this.ofDevice(deviceId).getCount(),
      matching.getCount(),
      newestFirst(this.ofDevice(deviceId)).getOne(),
      limit === 0 ? [] : newestFirst(this.olderThan(matching.clone(), before)).take(limit + 1).getMany(),
    ])
    const entries = found.slice(0, limit)

    return {
      entries: entries.map(toDeviceLogEntry),
      total,
      matching: matchingCount,
      nextCursor: found.length > limit ? encodeCursor(entries[entries.length - 1]) : null,
      newestCursor: newest ? encodeCursor(newest) : null,
    }
  }

  async clear(deviceId: string): Promise<void> {
    await this.requireDevice(deviceId)
    this.logger.log(`Clearing the Device Log of ${deviceId}`)
    await this.entryRepository.delete({ device: { id: deviceId } })
  }

  private ofDevice(deviceId: string): EntryQuery {
    return this.entryRepository.createQueryBuilder('entry').where('entry.deviceId = :deviceId', { deviceId })
  }

  private matching(deviceId: string, { level, q }: DeviceLogsQuery, after: LogPosition | null): EntryQuery {
    const entries = this.ofDevice(deviceId)
    if (level === 'problems')
      entries.andWhere('entry.level IN (:...levels)', { levels: PROBLEM_LEVELS })
    if (q !== undefined)
      entries.andWhere(`entry.message ILIKE :pattern ESCAPE '\\'`, { pattern: containing(q) })
    if (after)
      entries.andWhere('(entry.date, entry.id) > (:afterDate, :afterId)', { afterDate: after.date, afterId: after.id })
    return entries
  }

  private olderThan(entries: EntryQuery, before: LogPosition | null): EntryQuery {
    return before
      ? entries.andWhere('(entry.date, entry.id) < (:beforeDate, :beforeId)', { beforeDate: before.date, beforeId: before.id })
      : entries
  }

  private async requireDevice(deviceId: string): Promise<void> {
    if (isUUID(deviceId) && await this.deviceRepository.existsBy({ id: deviceId }))
      return
    this.logger.warn(`Device not found: ${deviceId}`)
    throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id: deviceId })
  }
}
