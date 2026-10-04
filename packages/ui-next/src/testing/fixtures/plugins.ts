import type { PluginDetail, PluginImportResult, PluginPlace, PluginSummary } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildPluginPlace = defineBuilder<PluginPlace>(() => ({
  screenId: '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
  name: 'Weekend board',
  deviceId: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11',
  deviceName: 'Kitchen',
}))

export const buildPluginSummary = defineBuilder<PluginSummary>(() => ({
  id: 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70',
  name: 'Weather',
  kind: 'Poll',
  sourceRecipeId: null,
  devices: [{ id: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11', name: 'Kitchen' }],
  mashups: [],
  worstFetchFailureStreak: 0,
  fetchAlertFiring: false,
  needsValues: false,
  webhookPayloadStored: null,
}))

export const buildPluginDetail = defineBuilder<PluginDetail>(() => ({
  id: 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70',
  name: 'Weather',
  description: 'Today and the next three days',
  kind: 'Poll',
  createdAt: '2026-09-12T09:20:00.000Z',
  updatedAt: '2026-10-01T18:04:00.000Z',
  refreshInterval: 30,
  templates: [{ size: 'full', liquidMarkup: '<div class="title">{{ forecast.today.summary }}</div>' }],
  dataSources: [{
    id: '6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e',
    name: 'forecast',
    mode: 'fetch',
    method: 'GET',
    url: 'https://api.open-meteo.com/v1/forecast?latitude={{ latitude }}&longitude={{ longitude }}',
    headers: {},
    body: {},
    transformJs: null,
    literalValue: null,
    fetchFailureStreak: 0,
    lastFetchAttemptAt: '2026-10-03T07:30:00.000Z',
    lastFetchSucceededAt: '2026-10-03T07:30:00.000Z',
    lastFetchError: null,
    alertFiring: false,
  }],
  fields: [],
  fieldValues: {},
  needsValues: false,
  webhook: null,
  recipe: null,
  assignments: [{
    deviceId: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11',
    deviceName: 'Kitchen',
    screenId: 'c2f1d0a4-5b6e-4c7d-8e9f-0a1b2c3d4e5f',
    order: 1,
    screenCount: 1,
    state: 'active',
  }],
  mashups: [],
  lastScheduledRender: { at: '2026-10-03T07:30:00.000Z', error: null },
}))

export const buildPluginImportResult = defineBuilder<PluginImportResult>(() => ({
  plugin: buildPluginDetail({
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    name: 'Moon Phase',
    description: 'Tonight\'s moon',
    assignments: [],
    lastScheduledRender: null,
    recipe: { id: '41120', name: 'Moon Phase', importedAt: '2026-10-03T07:35:00.000Z', snapshotTakenAt: '2026-10-03T07:35:00.000Z' },
  }),
  origin: { type: 'recipe', id: '41120', name: 'Moon Phase' },
  hasTransform: false,
}))
