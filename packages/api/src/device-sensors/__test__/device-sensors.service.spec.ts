import type { DeviceSensor } from '../entities/device-sensor.entity'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeDevice, makeDeviceSensor } from '../../test/fixtures'
import { asRepository, createMockRepository } from '../../test/mockRepository'
import { DeviceSensorsService } from '../device-sensors.service'

describe('deviceSensorsService', () => {
  let service: DeviceSensorsService
  let sensorRepo: ReturnType<typeof createMockRepository<DeviceSensor>>

  const device = makeDevice({ id: 'device-1' })

  beforeEach(() => {
    sensorRepo = createMockRepository<DeviceSensor>()
    sensorRepo.find.mockResolvedValue([])
    service = new DeviceSensorsService(asRepository(sensorRepo))
  })

  describe('syncFromHeader', () => {
    it('upserts every kind in a full valid header for a device with no prior rows', async () => {
      const header = 'make=Sensirion;model=SCD41;kind=temperature;value=21.5;unit=C;created_at=2026-08-22T00:00:00Z,make=Sensirion;model=SCD41;kind=humidity;value=45;unit=%;created_at=2026-08-22T00:00:00Z'

      await service.syncFromHeader(device, header)

      expect(sensorRepo.remove).not.toHaveBeenCalled()
      expect(sensorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ device, kind: 'temperature', value: 21.5, unit: 'C' }))
      expect(sensorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ device, kind: 'humidity', value: 45, unit: '%' }))
      expect(sensorRepo.save).toHaveBeenCalledTimes(2)
    })

    it('updates value/unit in place for a kind that already has a row', async () => {
      const existingRow = makeDeviceSensor({ id: 'row-1', kind: 'temperature', value: 20, unit: 'C', device })
      sensorRepo.find.mockResolvedValue([existingRow])

      await service.syncFromHeader(device, 'kind=temperature;value=22.1;unit=C')

      expect(sensorRepo.create).not.toHaveBeenCalled()
      expect(sensorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-1', kind: 'temperature', value: 22.1, unit: 'C' }))
    })

    it('clears only the kinds missing from this poll, leaving present kinds untouched', async () => {
      const temperatureRow = makeDeviceSensor({ id: 'row-1', kind: 'temperature', value: 20, unit: 'C', device })
      const humidityRow = makeDeviceSensor({ id: 'row-2', kind: 'humidity', value: 40, unit: '%', device })
      sensorRepo.find.mockResolvedValue([temperatureRow, humidityRow])

      await service.syncFromHeader(device, 'kind=temperature;value=21;unit=C')

      expect(sensorRepo.remove).toHaveBeenCalledWith([humidityRow])
      expect(sensorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-1', value: 21 }))
      expect(sensorRepo.save).toHaveBeenCalledTimes(1)
    })

    it('drops a record missing a required field instead of erroring', async () => {
      const header = 'kind=temperature;value=21;unit=C,kind=humidity;value=oops;unit=%,kind=pressure;unit=hPa,make=x;model=y'

      await service.syncFromHeader(device, header)

      expect(sensorRepo.save).toHaveBeenCalledTimes(1)
      expect(sensorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'temperature', value: 21, unit: 'C' }))
    })

    it('collapses a kind repeated within one header to its last occurrence, avoiding a duplicate insert', async () => {
      const header = 'kind=temperature;value=20;unit=C,kind=temperature;value=22.5;unit=C'

      await service.syncFromHeader(device, header)

      expect(sensorRepo.save).toHaveBeenCalledTimes(1)
      expect(sensorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'temperature', value: 22.5, unit: 'C' }))
    })

    it('drops a record with an unrecognised kind', async () => {
      await service.syncFromHeader(device, 'kind=light;value=100;unit=lux')

      expect(sensorRepo.save).not.toHaveBeenCalled()
    })

    it('clears every existing row when the header is absent', async () => {
      const temperatureRow = makeDeviceSensor({ id: 'row-1', kind: 'temperature', value: 20, unit: 'C', device })
      sensorRepo.find.mockResolvedValue([temperatureRow])

      await service.syncFromHeader(device, undefined)

      expect(sensorRepo.remove).toHaveBeenCalledWith([temperatureRow])
      expect(sensorRepo.save).not.toHaveBeenCalled()
    })

    it('clears every existing row when the header is blank', async () => {
      const temperatureRow = makeDeviceSensor({ id: 'row-1', kind: 'temperature', value: 20, unit: 'C', device })
      sensorRepo.find.mockResolvedValue([temperatureRow])

      await service.syncFromHeader(device, '')

      expect(sensorRepo.remove).toHaveBeenCalledWith([temperatureRow])
    })

    it('does nothing when the header is absent and there were no prior rows', async () => {
      await service.syncFromHeader(device, undefined)

      expect(sensorRepo.remove).not.toHaveBeenCalled()
      expect(sensorRepo.save).not.toHaveBeenCalled()
    })
  })

  describe('findForDevice', () => {
    it('queries rows scoped to the given device', async () => {
      const rows = [makeDeviceSensor({ id: 'row-1', kind: 'temperature', value: 21, unit: 'C', device })]
      sensorRepo.find.mockResolvedValue(rows)

      await expect(service.findForDevice('device-1')).resolves.toBe(rows)
      expect(sensorRepo.find).toHaveBeenCalledWith({ where: { device: { id: 'device-1' } } })
    })
  })
})
