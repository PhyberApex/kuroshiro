import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { CreateLogDto } from './dto/create-log.dto'
import { LogEntry } from './logs.entity'

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
    const device = await this.devicesRepository.findOne({ where: { mac: deviceMac }, relations: ['logs'] })
    if (!device) {
      this.logger.warn(`Device not found: ${deviceMac}`)
      throw new NotFoundException('Device not found')
    }
    this.logger.debug(`Checking ${logs.log.logs_array.length} entries of payload to consume.`)
    logs.log.logs_array.forEach((log) => {
      if (device.logs.find(logEntry => logEntry.logId === log.log_id)) {
        this.logger.log(`Log entry with id: ${log.log_id} for device ${device.id} already exists.`)
      }
      else {
        this.logger.debug(`Writing log entry with id: ${log.log_id} for device ${device.id}.`)
        this.logsRepository.create({
          entry: JSON.stringify(log),
          date: new Date().toISOString(),
          device,
          logId: log.log_id,
        })
      }
    })
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
