import type { DeviceDetail, DeviceSummary } from 'kuroshiro-shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { In, Repository } from 'typeorm'
import { DeviceSensorsService } from '../device-sensors/device-sensors.service.js'
import { ApiException } from '../errors/api.exception.js'
import { Screen } from '../screens/screens.entity.js'
import { toDeviceDetail, toDeviceSummary } from './device.mapper.js'
import { Device } from './devices.entity.js'

function byNameIgnoringCase(a: Device, b: Device): number {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.friendlyId.localeCompare(b.friendlyId)
}

@Injectable()
export class DeviceReadsService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    private readonly deviceSensors: DeviceSensorsService,
  ) {}

  async list(): Promise<DeviceSummary[]> {
    const devices = await this.deviceRepository.find()
    const servedScreens = await this.servedScreensById(devices)
    const now = new Date()
    return [...devices]
      .sort(byNameIgnoringCase)
      .map(device => toDeviceSummary(device, { now, servedScreen: this.servedScreenOf(device, servedScreens) }))
  }

  async detail(id: string): Promise<DeviceDetail> {
    const device = isUUID(id) ? await this.deviceRepository.findOneBy({ id }) : null
    if (!device)
      throw new ApiException(HttpStatus.NOT_FOUND, 'device-not-found', 'Device not found', { id })
    const [servedScreens, sensors, screenCount] = await Promise.all([
      this.servedScreensById([device]),
      this.deviceSensors.findForDevice(id),
      this.screenRepository.count({ where: { device: { id } } }),
    ])
    return toDeviceDetail(device, { now: new Date(), servedScreen: this.servedScreenOf(device, servedScreens), sensors, screenCount })
  }

  private async servedScreensById(devices: Device[]): Promise<Map<string, Screen>> {
    const ids = devices.flatMap(device => device.lastServedScreenId ? [device.lastServedScreenId] : [])
    if (ids.length === 0)
      return new Map()
    const screens = await this.screenRepository.find({ where: { id: In(ids) } })
    return new Map(screens.map(screen => [screen.id, screen]))
  }

  private servedScreenOf(device: Device, servedScreens: Map<string, Screen>): Screen | null {
    return (device.lastServedScreenId && servedScreens.get(device.lastServedScreenId)) || null
  }
}
