import type { ArchiveEntryLists } from '../services/archive-entry-violation.js'
import { describe, expect, it } from 'vitest'
import { archiveEntryViolation } from '../services/archive-entry-violation.js'
import { makeDeviceEntry } from './archive.js'

const ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'

const PALETTE = { id: ID, name: 'Warm red', kind: 'custom', grays: 2, colors: ['#000000', '#FFFFFF', '#ff0000'], frameworkClass: 'screen--color-3bwr', grayscaleBitDepth: null, deprecated: false }
const FIRMWARE = { id: ID, version: '2.0.3', checksum: 'abc', compatibleModels: [], label: null, deprecated: false, uploadedAt: null }
const PLUGIN = {
  id: ID,
  kind: 'Poll',
  mergeStrategy: null,
  streamLimit: null,
  webhookToken: null,
  sourceRecipeId: '150460',
  sourceRecipeSnapshot: null,
  dataSources: [{ id: ID, name: 'forecast' }],
  templates: [{ id: ID, layout: 'full' }],
  fields: [{ id: ID, keyname: 'city' }],
  fieldValues: {},
}
const ASSIGNMENT = { id: ID, deviceId: ID, pluginId: OTHER_ID, order: 1, isActive: true }
const SCREEN = {
  id: ID,
  deviceId: ID,
  type: 'mashup',
  order: 1,
  filename: null,
  externalLink: null,
  html: null,
  fetchManual: false,
  pluginId: null,
  devicePluginId: null,
  schedule: { id: ID, enabled: true, weekdays: null, startTime: null, endTime: null, startDate: null, endDate: null },
  mashupConfiguration: { id: ID, layout: '1Lx1R', slots: [{ id: ID, position: 'left', size: 'half_vertical', order: 1, pluginId: OTHER_ID }] },
}

function lists(overrides: Partial<Record<keyof ArchiveEntryLists, unknown[]>> = {}): ArchiveEntryLists {
  return {
    palettes: [PALETTE],
    firmware: [FIRMWARE],
    plugins: [PLUGIN],
    devices: [makeDeviceEntry({ id: ID, paletteId: 'bw', targetFirmwareId: OTHER_ID, rotationMode: 'manual' })],
    assignments: [ASSIGNMENT],
    screens: [SCREEN],
    ...overrides,
  } as unknown as ArchiveEntryLists
}

describe('archiveEntryViolation', () => {
  it('finds nothing wrong with entries the API would itself accept, a Device on an official Palette among them', () => {
    expect(archiveEntryViolation(lists())).toBeNull()
  })

  it('accepts what an archive older than a field reads as absent', () => {
    expect(archiveEntryViolation(lists({ devices: [makeDeviceEntry({ id: ID })], screens: [{ ...SCREEN, schedule: null, mashupConfiguration: null }] }))).toBeNull()
  })

  it.each([
    ['a Palette', { palettes: [{ ...PALETTE, id: '../../../somewhere/x' }] }, 'palettes.json entry "../../../somewhere/x": id is not a UUID'],
    ['a Firmware', { firmware: [{ ...FIRMWARE, id: 'fw-1' }] }, 'firmware.json entry "fw-1": id is not a UUID'],
    ['a Plugin', { plugins: [{ ...PLUGIN, id: 'plugin-1' }] }, 'plugins.json entry "plugin-1": id is not a UUID'],
    ['a Device', { devices: [makeDeviceEntry({ id: '../x' })] }, 'devices.json entry "../x": id is not a UUID'],
    ['an Assignment', { assignments: [{ ...ASSIGNMENT, id: 'a' }] }, 'assignments.json entry "a": id is not a UUID'],
    ['a Screen', { screens: [{ ...SCREEN, id: '../x' }] }, 'screens.json entry "../x": id is not a UUID'],
  ])('refuses %s whose id is no UUID, naming it', (_, overrides, violation) => {
    expect(archiveEntryViolation(lists(overrides))).toBe(violation)
  })

  it.each([
    ['a Data Source', { plugins: [{ ...PLUGIN, dataSources: [{ id: 'ds', name: 'forecast' }] }] }, 'dataSources[0].id is not a UUID'],
    ['a Template', { plugins: [{ ...PLUGIN, templates: [{ id: 'tpl', layout: 'full' }] }] }, 'templates[0].id is not a UUID'],
    ['a Plugin Field', { plugins: [{ ...PLUGIN, fields: [{ id: 'f', keyname: 'city' }] }] }, 'fields[0].id is not a UUID'],
    ['a Schedule', { screens: [{ ...SCREEN, schedule: { ...SCREEN.schedule, id: 's' } }] }, 'schedule.id is not a UUID'],
    ['a Mashup', { screens: [{ ...SCREEN, mashupConfiguration: { ...SCREEN.mashupConfiguration, id: 'm' } }] }, 'mashupConfiguration.id is not a UUID'],
    ['a Mashup slot', { screens: [{ ...SCREEN, mashupConfiguration: { ...SCREEN.mashupConfiguration, slots: [{ ...SCREEN.mashupConfiguration.slots[0], id: 'slot' }] } }] }, 'mashupConfiguration.slots[0].id is not a UUID'],
  ])('refuses %s nested in an entry whose id is no UUID', (_, overrides, violation) => {
    expect(archiveEntryViolation(lists(overrides))).toBe(`${Object.keys(overrides)[0]}.json entry "${ID}": ${violation}`)
  })

  it.each([
    ['an Assignment\'s Device', { assignments: [{ ...ASSIGNMENT, deviceId: '../x' }] }, 'assignments.json', 'deviceId is not a UUID'],
    ['an Assignment\'s Plugin', { assignments: [{ ...ASSIGNMENT, pluginId: 'p' }] }, 'assignments.json', 'pluginId is not a UUID'],
    ['a Screen\'s Device', { screens: [{ ...SCREEN, deviceId: '../x' }] }, 'screens.json', 'deviceId is not a UUID'],
    ['a Screen\'s Plugin', { screens: [{ ...SCREEN, pluginId: 'p' }] }, 'screens.json', 'pluginId is not a UUID'],
    ['a Screen\'s Assignment', { screens: [{ ...SCREEN, devicePluginId: 'dp' }] }, 'screens.json', 'devicePluginId is not a UUID'],
    ['a Mashup slot\'s Plugin', { screens: [{ ...SCREEN, mashupConfiguration: { ...SCREEN.mashupConfiguration, slots: [{ ...SCREEN.mashupConfiguration.slots[0], pluginId: 'p' }] } }] }, 'screens.json', 'mashupConfiguration.slots[0].pluginId is not a UUID'],
    ['a Device\'s target Firmware', { devices: [makeDeviceEntry({ id: ID, targetFirmwareId: 'fw' })] }, 'devices.json', 'targetFirmwareId is not a UUID'],
  ])('refuses a reference to %s that is no UUID', (_, overrides, file, violation) => {
    expect(archiveEntryViolation(lists(overrides))).toBe(`${file} entry "${ID}": ${violation}`)
  })

  it.each([
    ['a colour name', ['red']],
    ['a short hex colour', ['#fff']],
    ['an ImageMagick argument', ['#000000', '-write /tmp/x']],
    ['something other than text', [0]],
  ])('refuses a Palette with %s among its colours', (_, colors) => {
    expect(archiveEntryViolation(lists({ palettes: [{ ...PALETTE, colors }] }))).toBe(`palettes.json entry "${ID}": colors are not each a #RRGGBB hex colour`)
  })

  it.each([0, 1.5, 257, '2'])('refuses a Palette whose grays are %j', (grays) => {
    expect(archiveEntryViolation(lists({ palettes: [{ ...PALETTE, grays }] }))).toBe(`palettes.json entry "${ID}": grays is not a whole number from 1 to 256`)
  })

  it.each([
    ['a Palette\'s Palette Family', { palettes: [{ ...PALETTE, frameworkClass: 'screen--1bit' }] }, 'palettes.json', 'frameworkClass'],
    ['a Plugin\'s kind', { plugins: [{ ...PLUGIN, kind: 'Cron' }] }, 'plugins.json', 'kind'],
    ['a Plugin\'s merge strategy', { plugins: [{ ...PLUGIN, mergeStrategy: 'replace' }] }, 'plugins.json', 'mergeStrategy'],
    ['a Device\'s rotation mode', { devices: [makeDeviceEntry({ id: ID, rotationMode: 'sideways' })] }, 'devices.json', 'rotationMode'],
    ['a Screen\'s type', { screens: [{ ...SCREEN, type: 'video' }] }, 'screens.json', 'type'],
  ])('refuses %s that is none of its values', (_, overrides, file, key) => {
    expect(archiveEntryViolation(lists(overrides))).toMatch(new RegExp(`^${file.replace('.', '\\.')} entry "${ID}": ${key} is not one of `))
  })
})
