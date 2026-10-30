import type { ScreenRead } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { Plugin } from '../../plugins/entities/plugin.entity.js'
import { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import { Schedule } from '../../schedule/schedule.entity.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { PickedScreenController } from '../picked-screen.controller.js'
import { PickedScreenService } from '../picked-screen.service.js'
import { ScreenReadsService } from '../screen-reads.service.js'
import { Screen } from '../screens.entity.js'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

describe('setting and clearing a Device\'s Picked Screen, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let device: Device
  let otherDevice: Device

  beforeAll(async () => {
    database = await createTestDatabase()
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    http = await createHttpTestApp({
      controllers: [PickedScreenController],
      providers: [
        { provide: PickedScreenService, useValue: new PickedScreenService(database.getRepository(Device), database.getRepository(Screen)) },
        {
          provide: ScreenReadsService,
          useValue: new ScreenReadsService(database.getRepository(Screen), database.getRepository(Device), database.getRepository(Alert), fieldValues),
        },
      ],
    })
  })

  beforeEach(async () => {
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300 })
    otherDevice = await database.getRepository(Device).save({ name: 'Lobby', friendlyId: 'DEF456', mac: 'AA:BB:CC:DD:EE:02', apikey: 'other-secret', refreshRate: 300 })
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function seedScreen(order: number, overrides: Partial<Screen> & { owner?: Device } = {}): Promise<Screen> {
    const { owner, ...rest } = overrides
    return database.getRepository(Screen).save({ type: 'html', filename: `Screen ${order}`, html: '<p>Hi</p>', order, isActive: false, fetchManual: false, generatedAt: new Date(), device: owner ?? device, ...rest })
  }

  function send(method: string, deviceId: string, body?: { screenId: string }): Promise<Response> {
    return http.request(`/api/devices/${deviceId}/picked-screen`, {
      method,
      ...(body && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    })
  }

  async function storedPick(): Promise<string | null> {
    const stored = await database.getRepository(Device).findOneBy({ id: device.id })
    return stored?.pickedScreen?.id ?? null
  }

  describe('pUT /api/devices/:deviceId/picked-screen', () => {
    it('answers 200 with the Device\'s Screens, the picked one upNext and marked picked, and stores the pick', async () => {
      await seedScreen(1, { isActive: true })
      const target = await seedScreen(2)

      const response = await send('PUT', device.id, { screenId: target.id })
      const screens: ScreenRead[] = await response.json()

      expect(response.status).toBe(200)
      expect(screens.find(screen => screen.id === target.id)).toMatchObject({ state: 'upNext', picked: true })
      expect(await storedPick()).toBe(target.id)
    })

    it('replaces an existing pick with the new one', async () => {
      await seedScreen(1, { isActive: true })
      const first = await seedScreen(2)
      const second = await seedScreen(3)
      await send('PUT', device.id, { screenId: first.id })

      await send('PUT', device.id, { screenId: second.id })

      expect(await storedPick()).toBe(second.id)
    })

    it.each([UNKNOWN_ID, 'not-an-id'])('answers 404 device-not-found for the unknown Device %s', async (id) => {
      const target = await seedScreen(1)

      const response = await send('PUT', id, { screenId: target.id })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ statusCode: 404, code: 'device-not-found' })
    })

    it('answers 404 screen-not-found for an unknown Screen id', async () => {
      await seedScreen(1, { isActive: true })

      const response = await send('PUT', device.id, { screenId: UNKNOWN_ID })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ statusCode: 404, code: 'screen-not-found' })
    })

    it('answers 400 validation for a screenId that is not a UUID', async () => {
      await seedScreen(1, { isActive: true })

      const response = await send('PUT', device.id, { screenId: 'not-an-id' })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ statusCode: 400, code: 'validation' })
    })

    it('refuses a Screen of another Device with 400 picked-screen-wrong-device', async () => {
      await seedScreen(1, { isActive: true })
      const foreign = await seedScreen(1, { owner: otherDevice })

      const response = await send('PUT', device.id, { screenId: foreign.id })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ statusCode: 400, code: 'picked-screen-wrong-device' })
    })

    it('refuses on a mirrored Device with 409 picked-screen-mirrored', async () => {
      await database.getRepository(Device).update({ id: device.id }, { mirrorEnabled: true })
      const target = await seedScreen(1)

      const response = await send('PUT', device.id, { screenId: target.id })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ statusCode: 409, code: 'picked-screen-mirrored' })
    })

    it('refuses the Active Screen with 409 picked-screen-active', async () => {
      const active = await seedScreen(1, { isActive: true })

      const response = await send('PUT', device.id, { screenId: active.id })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ statusCode: 409, code: 'picked-screen-active' })
    })

    it('refuses a Screen whose Schedule excludes it at the next poll with 409 picked-screen-ineligible', async () => {
      await seedScreen(1, { isActive: true })
      const target = await seedScreen(2)
      await database.getRepository(Schedule).save({ enabled: false, screen: target })

      const response = await send('PUT', device.id, { screenId: target.id })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ statusCode: 409, code: 'picked-screen-ineligible' })
    })

    it('refuses a Plugin Screen carrying a remembered skip Render Signal with 409 picked-screen-ineligible', async () => {
      await seedScreen(1, { isActive: true })
      const plugin = await database.getRepository(Plugin).save({ name: 'Bins' })
      const target = await seedScreen(2, { type: 'plugin', filename: null, html: null, plugin, renderSignal: 'skip' })

      const response = await send('PUT', device.id, { screenId: target.id })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ statusCode: 409, code: 'picked-screen-ineligible' })
    })

    it('picks an HTML Screen carrying a stored skip, since Rotation evaluates its Render Signal afresh at the next poll', async () => {
      await seedScreen(1, { isActive: true })
      const target = await seedScreen(2, { renderSignal: 'skip' })

      const response = await send('PUT', device.id, { screenId: target.id })

      expect(response.status).toBe(200)
      expect(await storedPick()).toBe(target.id)
    })
  })

  describe('dELETE /api/devices/:deviceId/picked-screen', () => {
    it('clears the pick, so Up next reverts to what Order would give', async () => {
      await seedScreen(1, { isActive: true })
      const normalNext = await seedScreen(2)
      const picked = await seedScreen(3)
      await send('PUT', device.id, { screenId: picked.id })

      const response = await send('DELETE', device.id)
      const screens: ScreenRead[] = await response.json()

      expect(response.status).toBe(200)
      expect(await storedPick()).toBeNull()
      expect(screens.find(screen => screen.id === picked.id)).toMatchObject({ state: null, picked: false })
      expect(screens.find(screen => screen.id === normalNext.id)).toMatchObject({ state: 'upNext', picked: false })
    })

    it('is a no-op when there is no pick', async () => {
      await seedScreen(1, { isActive: true })

      const response = await send('DELETE', device.id)

      expect(response.status).toBe(200)
      expect(await storedPick()).toBeNull()
    })

    it.each([UNKNOWN_ID, 'not-an-id'])('answers 404 device-not-found for the unknown Device %s', async (id) => {
      const response = await send('DELETE', id)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ statusCode: 404, code: 'device-not-found' })
    })
  })
})
