import type { ScreenFacts } from '../screen.mapper.js'
import { describe, expect, it } from 'vitest'
import { makeMashupConfiguration, makeMashupSlot, makePlugin, makeSchedule, makeScreen } from '../../test/fixtures.js'
import { toScreenRead } from '../screen.mapper.js'

const RENDERED_AT = new Date('2026-03-01T09:30:00.000Z')

const WAITING_ITS_TURN: ScreenFacts = {
  deviceId: 'device-1',
  state: { state: null, stateCause: null },
  renderSignal: null,
  isRendered: true,
  requiredFieldEmpty: false,
  fetchAlertFiring: false,
}

describe('toScreenRead', () => {
  it('reads a File Screen with every key present and what does not apply as null', () => {
    const screen = makeScreen({ id: 'screen-photo', type: 'file', filename: 'Photo', order: 2, generatedAt: RENDERED_AT })

    expect(JSON.parse(JSON.stringify(toScreenRead(screen, WAITING_ITS_TURN)))).toEqual({
      id: 'screen-photo',
      deviceId: 'device-1',
      kind: 'file',
      name: 'Photo',
      order: 2,
      state: null,
      stateCause: null,
      renderSignal: null,
      imagePath: `/screens/devices/device-1/screen-photo.png?v=${RENDERED_AT.getTime()}`,
      renderedAt: '2026-03-01T09:30:00.000Z',
      schedule: null,
      plugin: null,
      mashup: null,
      external: null,
      file: { originalName: null, width: null, height: null, bytes: null, uploadedAt: '2026-03-01T09:30:00.000Z' },
      html: null,
    })
  })

  it('reads the facts stored at upload on a File Screen', () => {
    const screen = makeScreen({ type: 'file', fileOriginalName: 'holiday.jpg', fileWidth: 4032, fileHeight: 3024, fileBytes: 2_480_113 })

    expect(toScreenRead(screen, WAITING_ITS_TURN).file).toMatchObject({ originalName: 'holiday.jpg', width: 4032, height: 3024, bytes: 2_480_113 })
  })

  it('carries the Screen State, its cause and the Render Signal it is given', () => {
    const read = toScreenRead(makeScreen(), { ...WAITING_ITS_TURN, state: { state: 'notToday', stateCause: 'dateRange' }, renderSignal: 'hold' })

    expect(read).toMatchObject({ state: 'notToday', stateCause: 'dateRange', renderSignal: 'hold' })
  })

  it('reads a Screen never rendered without an image or a render time, although its creation time is stored', () => {
    const read = toScreenRead(makeScreen({ type: 'html', html: '<p>Hi</p>', generatedAt: RENDERED_AT }), { ...WAITING_ITS_TURN, isRendered: false })

    expect(read).toMatchObject({ imagePath: null, renderedAt: null })
  })

  it('reads the Schedule\'s times as HH:MM and its dates as stored', () => {
    const schedule = makeSchedule({ id: 'schedule-9', enabled: false, weekdays: [1, 5], startTime: '06:00:00', endTime: '09:30:00', startDate: '2026-03-01', endDate: '2026-08-31' })

    expect(toScreenRead(makeScreen({ schedule }), WAITING_ITS_TURN).schedule).toEqual({
      id: 'schedule-9',
      enabled: false,
      weekdays: [1, 5],
      startTime: '06:00',
      endTime: '09:30',
      startDate: '2026-03-01',
      endDate: '2026-08-31',
    })
  })

  it('reads a Schedule for every day, all day, with null days, hours and dates', () => {
    expect(toScreenRead(makeScreen({ schedule: makeSchedule() }), WAITING_ITS_TURN).schedule).toEqual({
      id: 'schedule-1',
      enabled: true,
      weekdays: null,
      startTime: null,
      endTime: null,
      startDate: null,
      endDate: null,
    })
  })

  describe('a Plugin Screen', () => {
    const plugin = makePlugin({ id: 'plugin-weather', name: 'Weather', kind: 'Webhook', webhookToken: 'secret-token' })
    const screen = makeScreen({ type: 'plugin', plugin, filename: null })

    it('takes its name from its Plugin and reads a reference to it, never the Plugin or a secret', () => {
      const read = toScreenRead(screen, { ...WAITING_ITS_TURN, requiredFieldEmpty: true, fetchAlertFiring: true })

      expect(read).toMatchObject({ kind: 'plugin', name: 'Weather', file: null, html: null, mashup: null, external: null })
      expect(read.plugin).toEqual({ id: 'plugin-weather', name: 'Weather', kind: 'Webhook', requiredFieldEmpty: true, fetchAlertFiring: true })
      expect(JSON.stringify(read)).not.toContain('secret-token')
    })
  })

  describe('a Mashup Screen', () => {
    const clock = makePlugin({ id: 'plugin-clock', name: 'Clock' })
    const weather = makePlugin({ id: 'plugin-weather', name: 'Weather' })
    const news = makePlugin({ id: 'plugin-news', name: 'News' })

    it('reads its layout and its slots in slot order, each with its Plugin', () => {
      const mashupConfiguration = makeMashupConfiguration({
        layout: '1Lx2R',
        slots: [
          makeMashupSlot({ position: 'bottom-right', size: 'view--quadrant', order: 2, plugin: news }),
          makeMashupSlot({ position: 'left', size: 'view--half_vertical', order: 0, plugin: clock }),
          makeMashupSlot({ position: 'top-right', size: 'view--quadrant', order: 1, plugin: weather }),
        ],
      })
      const read = toScreenRead(makeScreen({ type: 'mashup', filename: 'Morning', mashupConfiguration }), WAITING_ITS_TURN)

      expect(read).toMatchObject({ kind: 'mashup', name: 'Morning', plugin: null })
      expect(read.mashup).toEqual({
        layout: '1Lx2R',
        slots: [
          { position: 'left', size: 'half_vertical', pluginId: 'plugin-clock', pluginName: 'Clock' },
          { position: 'top-right', size: 'quadrant', pluginId: 'plugin-weather', pluginName: 'Weather' },
          { position: 'bottom-right', size: 'quadrant', pluginId: 'plugin-news', pluginName: 'News' },
        ],
      })
    })

    it('reads no Mashup when its configuration is missing or names an unknown layout', () => {
      const unknownLayout = makeMashupConfiguration({ layout: '3x3' })

      expect(toScreenRead(makeScreen({ type: 'mashup' }), WAITING_ITS_TURN).mashup).toBeNull()
      expect(toScreenRead(makeScreen({ type: 'mashup', mashupConfiguration: unknownLayout }), WAITING_ITS_TURN).mashup).toBeNull()
    })
  })

  it('reads an External link Screen\'s address and whether its image is fetched once and kept', () => {
    const screen = makeScreen({ type: 'external', filename: 'Webcam', externalLink: 'https://example.com/cam.jpg', fetchManual: true })

    expect(toScreenRead(screen, WAITING_ITS_TURN)).toMatchObject({
      kind: 'external',
      external: { url: 'https://example.com/cam.jpg', fetchManual: true },
      file: null,
    })
  })

  it('reads an HTML Screen\'s markup', () => {
    const screen = makeScreen({ type: 'html', filename: 'Note', html: '<p>Hi</p>' })

    expect(toScreenRead(screen, WAITING_ITS_TURN)).toMatchObject({ kind: 'html', html: '<p>Hi</p>', file: null })
  })
})
