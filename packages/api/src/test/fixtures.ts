import type { DeviceModel } from '../device-models/entities/device-model.entity.js'
import type { Palette } from '../device-models/entities/palette.entity.js'
import type { DeviceSensor } from '../device-sensors/entities/device-sensor.entity.js'
import type { Device } from '../devices/devices.entity.js'
import type { Firmware } from '../firmware/entities/firmware.entity.js'
import type { LogEntry } from '../logs/logs.entity.js'
import type { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity.js'
import type { MashupSlot } from '../mashup/entities/mashup-slot.entity.js'
import type { DevicePlugin } from '../plugins/entities/device-plugin.entity.js'
import type { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import type { PluginField } from '../plugins/entities/plugin-field.entity.js'
import type { PluginTemplate } from '../plugins/entities/plugin-template.entity.js'
import type { PluginVariable } from '../plugins/entities/plugin-variable.entity.js'
import type { Plugin } from '../plugins/entities/plugin.entity.js'
import type { Schedule } from '../schedule/schedule.entity.js'
import type { Screen } from '../screens/screens.entity.js'

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z')

export function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'device-1',
    name: 'Test Device',
    friendlyId: 'ABC123',
    mac: 'AA:BB:CC:DD:EE:FF',
    apikey: 'test-api-key',
    refreshRate: 300,
    specialFunction: 'identify',
    sleepModeEnabled: false,
    sleepScreenEnabled: false,
    resetDevice: false,
    updateFirmware: false,
    lastSeen: FIXED_DATE,
    screens: [],
    logs: [],
    ...overrides,
  }
}

export function makeScreen(overrides: Partial<Screen> = {}): Screen {
  return {
    id: 'screen-1',
    type: 'file',
    fetchManual: false,
    isActive: false,
    order: 0,
    generatedAt: FIXED_DATE,
    device: makeDevice(),
    ...overrides,
  }
}

export function makeLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log-1',
    entry: 'test log entry',
    date: FIXED_DATE,
    logId: 1,
    device: makeDevice(),
    ...overrides,
  }
}

export function makeDeviceSensor(overrides: Partial<DeviceSensor> = {}): DeviceSensor {
  return {
    id: 'sensor-1',
    kind: 'temperature',
    value: 21,
    unit: 'C',
    device: makeDevice(),
    ...overrides,
  }
}

export function makePalette(overrides: Partial<Palette> = {}): Palette {
  return {
    id: 'palette-1',
    name: 'Test Palette',
    kind: 'official',
    grays: 2,
    frameworkClass: 'screen--1bit',
    deprecated: false,
    ...overrides,
  }
}

export function makeDeviceModel(overrides: Partial<DeviceModel> = {}): DeviceModel {
  return {
    name: 'og_plus',
    label: 'TRMNL OG (2-bit)',
    description: null,
    width: 800,
    height: 480,
    colors: 4,
    bitDepth: 2,
    scaleFactor: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    mimeType: 'image/png',
    kind: 'trmnl',
    paletteIds: ['bw', 'gray-4'],
    cssClasses: ['screen--og_plus', 'screen--md', 'screen--density-1x'],
    cssVariables: { '--screen-w': '800px', '--screen-h': '480px' },
    imageSizeLimit: 90000,
    deprecated: false,
    syncedAt: null,
    ...overrides,
  }
}

export function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: 'plugin-1',
    name: 'Test Plugin',
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    dataSources: [],
    templates: [],
    fields: [],
    variables: [],
    ...overrides,
  }
}

export function makeDevicePlugin(overrides: Partial<DevicePlugin> = {}): DevicePlugin {
  return {
    id: 'device-plugin-1',
    isActive: true,
    order: 0,
    device: makeDevice(),
    plugin: makePlugin(),
    ...overrides,
  }
}

export function makePluginDataSource(overrides: Partial<PluginDataSource> = {}): PluginDataSource {
  return {
    id: 'data-source-1',
    name: 'Test Source',
    mode: 'fetch',
    method: 'GET',
    url: 'https://example.com/data',
    order: 0,
    plugin: makePlugin(),
    ...overrides,
  }
}

export function makePluginTemplate(overrides: Partial<PluginTemplate> = {}): PluginTemplate {
  return {
    id: 'template-1',
    layout: 'full',
    liquidMarkup: '<div>{{ trmnl }}</div>',
    plugin: makePlugin(),
    ...overrides,
  }
}

export function makePluginField(overrides: Partial<PluginField> = {}): PluginField {
  return {
    id: 'field-1',
    keyname: 'test_field',
    fieldType: 'string',
    name: 'Test Field',
    required: false,
    order: 0,
    plugin: makePlugin(),
    ...overrides,
  }
}

export function makePluginVariable(overrides: Partial<PluginVariable> = {}): PluginVariable {
  return {
    id: 'variable-1',
    key: 'API_KEY',
    value: 'secret',
    isSecret: false,
    plugin: makePlugin(),
    ...overrides,
  }
}

export function makeMashupConfiguration(overrides: Partial<MashupConfiguration> = {}): MashupConfiguration {
  return {
    id: 'mashup-config-1',
    layout: '2x1',
    screen: makeScreen(),
    slots: [],
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

export function makeFirmware(overrides: Partial<Firmware> = {}): Firmware {
  return {
    id: 'firmware-1',
    version: '1.0.0',
    kind: 'official-synced',
    checksum: 'checksum-1',
    compatibleModels: [],
    deprecated: false,
    ...overrides,
  }
}

export function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'schedule-1',
    enabled: true,
    screen: makeScreen(),
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

export function makeMashupSlot(overrides: Partial<MashupSlot> = {}): MashupSlot {
  return {
    id: 'mashup-slot-1',
    position: 'top',
    size: '1x1',
    plugin: makePlugin(),
    mashupConfiguration: makeMashupConfiguration(),
    order: 0,
    ...overrides,
  }
}
