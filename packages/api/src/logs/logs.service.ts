import type { JsonObject } from '../utils/json.js'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity.js'
import { CreateLogDto } from './dto/create-log.dto.js'
import { LogEntry } from './logs.entity.js'

const MIN_PLAUSIBLE_UNIX_SECONDS = Date.UTC(2020, 0, 1) / 1000
const MAX_FUTURE_SKEW_SECONDS = 24 * 60 * 60

function entriesOf(logs: CreateLogDto): JsonObject[] {
  return logs.logs ?? logs.log?.logs_array ?? []
}

function extractLogId(entry: JsonObject): number | undefined {
  const value = entry.id ?? entry.log_id
  return typeof value === 'number' ? value : undefined
}

function resolveLogDate(entry: JsonObject): Date {
  const timestamp = entry.created_at ?? entry.creation_timestamp
  if (typeof timestamp === 'number') {
    const nowSeconds = Date.now() / 1000
    if (timestamp >= MIN_PLAUSIBLE_UNIX_SECONDS && timestamp <= nowSeconds + MAX_FUTURE_SKEW_SECONDS)
      return new Date(timestamp * 1000)
  }
  return new Date()
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name)
  constructor(
    @InjectRepository(LogEntry)
    private logsRepository: Repository<LogEntry>,
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
  ) {}

  async addLogToDevice(deviceMac: string, logs: CreateLogDto) {
    const device = await this.devicesRepository.findOne({ where: { mac: deviceMac }, relations: { logs: true } })
    if (!device) {
      this.logger.warn(`Device not found: ${deviceMac}`)
      throw new NotFoundException('Device not found')
    }
    const entries = entriesOf(logs)
    this.logger.debug(`Checking ${entries.length} entries of payload to consume.`)
    for (const entry of entries) {
      const logId = extractLogId(entry)
      if (logId === undefined) {
        this.logger.warn(`Log entry without id/log_id for device ${device.id}, skipping.`)
        continue
      }
      if (device.logs.some(logEntry => logEntry.logId === logId)) {
        this.logger.log(`Log entry with id: ${logId} for device ${device.id} already exists.`)
      }
      else {
        this.logger.debug(`Writing log entry with id: ${logId} for device ${device.id}.`)
        await this.logsRepository.save({
          entry: JSON.stringify(entry),
          date: resolveLogDate(entry),
          device,
          logId,
        })
      }
    }
  }

  async getByDevice(deviceId: string): Promise<LogEntry[]> {
    this.logger.log(`Fetching logs for device ${deviceId}`)
    return this.logsRepository.find({ where: { device: { id: deviceId } }, order: { date: 'ASC' } })
  }

  async clearLogsByDeviceId(deviceId: string) {
    this.logger.log(`Clearing logs for device ${deviceId}`)
    await this.logsRepository.delete({ device: { id: deviceId } })
  }
}
