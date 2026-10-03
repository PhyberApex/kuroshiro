import type { PluginDetailFacts, PluginFacts } from '../plugin.mapper.js'
import { describe, expect, it } from 'vitest'
import { makeDevice, makePlugin, makePluginDataSource, makePluginField, makePluginTemplate, makeSchedule, makeScreen } from '../../test/fixtures.js'
import { toPluginDetail, toPluginSummary } from '../plugin.mapper.js'

const CREATED_AT = new Date('2026-02-01T08:00:00.000Z')
const UPDATED_AT = new Date('2026-02-02T08:00:00.000Z')
const NOW = new Date('2026-03-01T09:30:00.000Z')

const NOTHING_AROUND: PluginFacts = {
  storedFieldValues: {},
  firingDataSourceIds: new Set(),
  assignmentScreens: [],
  mashupScreens: [],
}

const NOTHING_AROUND_IN_DETAIL: PluginDetailFacts = {
  ...NOTHING_AROUND,
  screensByDevice: new Map(),
  now: NOW,
  apiUrl: 'https://kuroshiro.example',
}

const kitchen = makeDevice({ id: 'device-kitchen', name: 'Kitchen' })
const attic = makeDevice({ id: 'device-attic', name: 'attic' })
const hall = makeDevice({ id: 'device-hall', name: 'Hall' })

function serialized<T>(read: T): unknown {
  return JSON.parse(JSON.stringify(read))
}

describe('toPluginSummary', () => {
  it('reads a Poll-kind Plugin with every key present and nothing a row does not show', () => {
    const plugin = makePlugin({
      id: 'plugin-weather',
      name: 'Weather',
      description: 'Not on the list',
      sourceRecipeId: 'recipe-7',
      sourceRecipeSnapshot: { name: 'Weather Recipe' },
      webhookToken: 'token-secret',
      webhookPayload: { leaked: true },
      templates: [makePluginTemplate({ liquidMarkup: '<p>secret markup</p>' })],
      dataSources: [makePluginDataSource({ id: 'source-1', fetchFailureStreak: 2 }), makePluginDataSource({ id: 'source-2', fetchFailureStreak: 5 })],
    })

    expect(serialized(toPluginSummary(plugin, NOTHING_AROUND))).toEqual({
      id: 'plugin-weather',
      name: 'Weather',
      kind: 'Poll',
      sourceRecipeId: 'recipe-7',
      devices: [],
      mashups: [],
      worstFetchFailureStreak: 5,
      fetchAlertFiring: false,
      needsValues: false,
      webhookPayloadStored: null,
    })
  })

  it('reads a Webhook-kind Plugin without a streak and says whether a Webhook Payload is stored', () => {
    const waiting = makePlugin({ kind: 'Webhook', webhookPayload: null, dataSources: [makePluginDataSource({ fetchFailureStreak: 4 })] })
    const fed = makePlugin({ kind: 'Webhook', webhookPayload: { temperature: 21 } })

    expect(toPluginSummary(waiting, NOTHING_AROUND)).toMatchObject({ worstFetchFailureStreak: 0, webhookPayloadStored: false, sourceRecipeId: null })
    expect(toPluginSummary(fed, NOTHING_AROUND)).toMatchObject({ webhookPayloadStored: true })
  })

  it('names the Devices it is assigned to by name, without regard to case, and nothing else of them', () => {
    const facts = {
      ...NOTHING_AROUND,
      assignmentScreens: [
        makeScreen({ id: 'screen-k', type: 'plugin', device: kitchen }),
        makeScreen({ id: 'screen-a', type: 'plugin', device: attic }),
        makeScreen({ id: 'screen-h', type: 'plugin', device: hall }),
      ],
    }

    expect(serialized(toPluginSummary(makePlugin(), facts))).toMatchObject({
      devices: [{ id: 'device-attic', name: 'attic' }, { id: 'device-hall', name: 'Hall' }, { id: 'device-kitchen', name: 'Kitchen' }],
    })
  })

  it('lists each Mashup holding it in a slot once, with its Device', () => {
    const facts = {
      ...NOTHING_AROUND,
      mashupScreens: [
        makeScreen({ id: 'screen-m2', type: 'mashup', filename: 'Morning', device: kitchen }),
        makeScreen({ id: 'screen-m1', type: 'mashup', filename: 'Evening', device: hall }),
        makeScreen({ id: 'screen-m2', type: 'mashup', filename: 'Morning', device: kitchen }),
      ],
    }

    expect(toPluginSummary(makePlugin(), facts).mashups).toEqual([
      { screenId: 'screen-m1', name: 'Evening', deviceId: 'device-hall', deviceName: 'Hall' },
      { screenId: 'screen-m2', name: 'Morning', deviceId: 'device-kitchen', deviceName: 'Kitchen' },
    ])
  })

  it('says a fetch Alert fires when one of its Data Sources has one', () => {
    const plugin = makePlugin({ dataSources: [makePluginDataSource({ id: 'source-1' }), makePluginDataSource({ id: 'source-2' })] })

    expect(toPluginSummary(plugin, { ...NOTHING_AROUND, firingDataSourceIds: new Set(['source-2']) }).fetchAlertFiring).toBe(true)
    expect(toPluginSummary(plugin, { ...NOTHING_AROUND, firingDataSourceIds: new Set(['source-of-another-plugin']) }).fetchAlertFiring).toBe(false)
  })

  it('needs values while a required Plugin Field has neither a Field Value nor a default', () => {
    const plugin = makePlugin({ fields: [makePluginField({ keyname: 'city', required: true })] })

    expect(toPluginSummary(plugin, NOTHING_AROUND).needsValues).toBe(true)
    expect(toPluginSummary(plugin, { ...NOTHING_AROUND, storedFieldValues: { city: 'Berlin' } }).needsValues).toBe(false)
  })
})

describe('toPluginDetail', () => {
  it('reads a bare Poll-kind Plugin with every key present and what does not apply as null', () => {
    const plugin = makePlugin({ id: 'plugin-bare', name: 'Bare', createdAt: CREATED_AT, updatedAt: UPDATED_AT, refreshInterval: 30 })

    expect(serialized(toPluginDetail(plugin, NOTHING_AROUND_IN_DETAIL))).toEqual({
      id: 'plugin-bare',
      name: 'Bare',
      description: null,
      kind: 'Poll',
      createdAt: '2026-02-01T08:00:00.000Z',
      updatedAt: '2026-02-02T08:00:00.000Z',
      refreshInterval: 30,
      templates: [{ size: 'full', liquidMarkup: '' }],
      dataSources: [],
      fields: [],
      fieldValues: {},
      needsValues: false,
      webhook: null,
      recipe: null,
      assignments: [],
      mashups: [],
      lastScheduledRender: null,
    })
  })

  it('reads its Templates by size, the full one first', () => {
    const plugin = makePlugin({
      templates: [
        makePluginTemplate({ layout: 'quadrant', liquidMarkup: '<p>quarter</p>' }),
        makePluginTemplate({ layout: 'full', liquidMarkup: '<p>whole</p>' }),
      ],
    })

    expect(toPluginDetail(plugin, NOTHING_AROUND_IN_DETAIL).templates).toEqual([
      { size: 'full', liquidMarkup: '<p>whole</p>' },
      { size: 'quadrant', liquidMarkup: '<p>quarter</p>' },
    ])
  })

  it('reads a fetch Data Source as written, headers included, with its fetch facts', () => {
    const plugin = makePlugin({
      dataSources: [makePluginDataSource({
        id: 'source-1',
        name: 'weather',
        method: 'POST',
        url: 'https://api.example.com/{{ city }}',
        headers: { Authorization: 'Bearer {{ api_key }}' },
        body: { units: 'metric' },
        transformJs: 'return input',
        fetchFailureStreak: 3,
        lastFetchAttemptAt: new Date('2026-03-01T09:00:00.000Z'),
        lastFetchSucceededAt: new Date('2026-03-01T08:15:00.000Z'),
        lastFetchError: 'HTTP 503',
      })],
    })

    const read = toPluginDetail(plugin, { ...NOTHING_AROUND_IN_DETAIL, firingDataSourceIds: new Set(['source-1']) })

    expect(serialized(read.dataSources)).toEqual([{
      id: 'source-1',
      name: 'weather',
      mode: 'fetch',
      method: 'POST',
      url: 'https://api.example.com/{{ city }}',
      headers: { Authorization: 'Bearer {{ api_key }}' },
      body: { units: 'metric' },
      transformJs: 'return input',
      literalValue: null,
      fetchFailureStreak: 3,
      lastFetchAttemptAt: '2026-03-01T09:00:00.000Z',
      lastFetchSucceededAt: '2026-03-01T08:15:00.000Z',
      lastFetchError: 'HTTP 503',
      alertFiring: true,
    }])
  })

  it('reads a literal Data Source with its value and none of the fetch settings, in the Data Sources\' order', () => {
    const plugin = makePlugin({
      dataSources: [
        makePluginDataSource({ id: 'source-2', name: 'second', order: 1 }),
        makePluginDataSource({ id: 'source-1', name: 'greeting', mode: 'literal', literalValue: { text: 'Hi' }, order: 0, url: null }),
      ],
    })

    const [literal, fetched] = toPluginDetail(plugin, NOTHING_AROUND_IN_DETAIL).dataSources

    expect(serialized(literal)).toEqual({
      id: 'source-1',
      name: 'greeting',
      mode: 'literal',
      method: null,
      url: null,
      headers: null,
      body: null,
      transformJs: null,
      literalValue: { text: 'Hi' },
      fetchFailureStreak: 0,
      lastFetchAttemptAt: null,
      lastFetchSucceededAt: null,
      lastFetchError: null,
      alertFiring: false,
    })
    expect(fetched).toMatchObject({ name: 'second', method: 'GET', headers: null, body: null, transformJs: null })
  })

  it('reads a Plugin Field in the glossary\'s words, in the Plugin Fields\' order', () => {
    const plugin = makePlugin({
      fields: [
        makePluginField({ id: 'field-2', keyname: 'units', order: 2, fieldType: 'select', name: 'Units', options: [{ label: 'Metric', value: 'metric' }] }),
        makePluginField({ id: 'field-1', keyname: 'city', order: 1, fieldType: 'string', name: 'City', description: 'Where you live', defaultValue: 'Berlin', required: true }),
      ],
    })

    expect(toPluginDetail(plugin, NOTHING_AROUND_IN_DETAIL).fields).toEqual([
      { id: 'field-1', keyname: 'city', label: 'City', type: 'string', helpText: 'Where you live', default: 'Berlin', required: true, order: 1, options: null },
      { id: 'field-2', keyname: 'units', label: 'Units', type: 'select', helpText: null, default: null, required: false, order: 2, options: [{ label: 'Metric', value: 'metric' }] },
    ])
  })

  it('reads a Field Value by keyname and a password only as set or not, its value nowhere', () => {
    const plugin = makePlugin({
      fields: [
        makePluginField({ id: 'field-1', keyname: 'city', required: true }),
        makePluginField({ id: 'field-2', keyname: 'api_key', fieldType: 'password' }),
        makePluginField({ id: 'field-3', keyname: 'other_key', fieldType: 'password' }),
        makePluginField({ id: 'field-4', keyname: 'units' }),
      ],
    })

    const read = toPluginDetail(plugin, { ...NOTHING_AROUND_IN_DETAIL, storedFieldValues: { api_key: 'hunter2', units: 'metric' } })

    expect(read.fieldValues).toEqual({
      city: { secret: false, value: null },
      api_key: { secret: true, set: true },
      other_key: { secret: true, set: false },
      units: { secret: false, value: 'metric' },
    })
    expect(read.needsValues).toBe(true)
    expect(JSON.stringify(read)).not.toContain('hunter2')
  })

  it('reads a Webhook-kind Plugin with its Webhook Token, the address a sender posts to and no polling', () => {
    const plugin = makePlugin({
      kind: 'Webhook',
      webhookToken: 'token-123',
      mergeStrategy: 'stream',
      streamLimit: 20,
      webhookPayload: { readings: [1, 2] },
      payloadReceivedAt: new Date('2026-03-01T09:10:00.000Z'),
      dataSources: [makePluginDataSource()],
    })

    expect(serialized(toPluginDetail(plugin, NOTHING_AROUND_IN_DETAIL))).toMatchObject({
      refreshInterval: null,
      dataSources: [],
      webhook: {
        token: 'token-123',
        url: 'https://kuroshiro.example/api/webhook/token-123',
        mergeStrategy: 'stream',
        streamLimit: 20,
        payload: { readings: [1, 2] },
        payloadReceivedAt: '2026-03-01T09:10:00.000Z',
      },
    })
  })

  it('reads a Webhook-kind Plugin nothing was posted to with an empty payload', () => {
    const plugin = makePlugin({ kind: 'Webhook', webhookToken: 'token-123', mergeStrategy: 'standard' })

    expect(toPluginDetail(plugin, NOTHING_AROUND_IN_DETAIL).webhook).toEqual({
      token: 'token-123',
      url: 'https://kuroshiro.example/api/webhook/token-123',
      mergeStrategy: 'standard',
      streamLimit: null,
      payload: null,
      payloadReceivedAt: null,
    })
  })

  it('reads the Recipe it came from, imported when the Plugin was created', () => {
    const imported = makePlugin({ sourceRecipeId: 'recipe-7', sourceRecipeSnapshot: { name: 'Weather Recipe' }, snapshotTakenAt: new Date('2026-02-20T10:00:00.000Z'), createdAt: CREATED_AT })
    const importedBeforeSnapshots = makePlugin({ sourceRecipeId: 'recipe-7', sourceRecipeSnapshot: null, createdAt: CREATED_AT })

    expect(serialized(toPluginDetail(imported, NOTHING_AROUND_IN_DETAIL).recipe)).toEqual({
      id: 'recipe-7',
      name: 'Weather Recipe',
      importedAt: '2026-02-01T08:00:00.000Z',
      snapshotTakenAt: '2026-02-20T10:00:00.000Z',
    })
    expect(toPluginDetail(importedBeforeSnapshots, NOTHING_AROUND_IN_DETAIL).recipe).toEqual({
      id: 'recipe-7',
      name: null,
      importedAt: '2026-02-01T08:00:00.000Z',
      snapshotTakenAt: null,
    })
  })

  it('reads each Plugin Assignment with its place in the Device\'s Order and its Screen State', () => {
    const onKitchen = makeScreen({ id: 'screen-k2', type: 'plugin', order: 2, isActive: false, device: kitchen })
    const onHall = makeScreen({ id: 'screen-h1', type: 'plugin', order: 1, isActive: false, device: hall, schedule: makeSchedule({ enabled: false }) })
    const facts: PluginDetailFacts = {
      ...NOTHING_AROUND_IN_DETAIL,
      assignmentScreens: [onKitchen, onHall],
      screensByDevice: new Map([
        ['device-kitchen', [makeScreen({ id: 'screen-k1', order: 1, isActive: true, device: kitchen }), onKitchen, makeScreen({ id: 'screen-k3', order: 3, isActive: false, device: kitchen })]],
        ['device-hall', [onHall]],
      ]),
    }

    expect(toPluginDetail(makePlugin(), facts).assignments).toEqual([
      { deviceId: 'device-hall', deviceName: 'Hall', screenId: 'screen-h1', order: 1, screenCount: 1, state: 'scheduleOff' },
      { deviceId: 'device-kitchen', deviceName: 'Kitchen', screenId: 'screen-k2', order: 2, screenCount: 3, state: 'upNext' },
    ])
  })

  it('reads no Screen State for an assignment on a mirrored Device', () => {
    const mirrored = makeDevice({ id: 'device-mirror', name: 'Mirror', mirrorEnabled: true })
    const screen = makeScreen({ id: 'screen-1', type: 'plugin', order: 1, isActive: true, device: mirrored })
    const facts: PluginDetailFacts = { ...NOTHING_AROUND_IN_DETAIL, assignmentScreens: [screen], screensByDevice: new Map([['device-mirror', [screen]]]) }

    expect(toPluginDetail(makePlugin(), facts).assignments).toEqual([
      { deviceId: 'device-mirror', deviceName: 'Mirror', screenId: 'screen-1', order: 1, screenCount: 1, state: null },
    ])
  })

  it('lists the Mashups holding it in a slot', () => {
    const facts = { ...NOTHING_AROUND_IN_DETAIL, mashupScreens: [makeScreen({ id: 'screen-m1', type: 'mashup', filename: 'Morning', device: kitchen })] }

    expect(toPluginDetail(makePlugin(), facts).mashups).toEqual([
      { screenId: 'screen-m1', name: 'Morning', deviceId: 'device-kitchen', deviceName: 'Kitchen' },
    ])
  })

  it('reads the last scheduled render, with the error that stopped it when one is stored', () => {
    const rendered = makePlugin({ lastScheduledRenderAt: new Date('2026-03-01T09:15:00.000Z') })
    const failed = makePlugin({
      lastScheduledRenderAt: new Date('2026-03-01T09:15:00.000Z'),
      lastScheduledRenderError: 'unknown tag "endfour"',
      lastScheduledRenderErrorLine: 12,
      lastScheduledRenderErrorSize: 'quadrant',
    })

    expect(toPluginDetail(rendered, NOTHING_AROUND_IN_DETAIL).lastScheduledRender).toEqual({ at: '2026-03-01T09:15:00.000Z', error: null })
    expect(toPluginDetail(failed, NOTHING_AROUND_IN_DETAIL).lastScheduledRender).toEqual({
      at: '2026-03-01T09:15:00.000Z',
      error: { message: 'unknown tag "endfour"', line: 12, size: 'quadrant' },
    })
  })
})
