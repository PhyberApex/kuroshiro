import type { DataSourceInput, PluginDetail, TemplateSize } from 'kuroshiro-shared'
import type { DeviceReport, PlayedDevice } from '../real-api/devicePlayer.ts'
import type { InstanceApi } from './instanceApi.ts'
import { connectDevice } from '../real-api/devicePlayer.ts'
import {
  AIR_QUALITY,
  BEDTIME_HTML,
  CALENDAR_PAYLOAD,
  CALENDAR_TEMPLATES,
  DEPARTURES,
  DEPARTURES_TEMPLATES,
  ENERGY_PAYLOAD,
  ENERGY_TEMPLATES,
  HALLWAY_HTML,
  MORNING_BRIEFING_HTML,
  OFFICE_HTML,
  QUOTE,
  QUOTE_TEMPLATES,
  WASTE_TEMPLATES,
  WEATHER_FORECAST,
  WEATHER_TEMPLATES,
} from './content.ts'

const HOUR = 3600

function templatesOf(templates: Partial<Record<TemplateSize, string>>) {
  return Object.entries(templates).map(([size, liquidMarkup]) => ({ size: size as TemplateSize, liquidMarkup }))
}

const literal = (name: string, literalValue: Record<string, unknown>): DataSourceInput => ({ name, mode: 'literal', literalValue })

function sensors(temperature: number, humidity: number) {
  return [
    `make=Sensirion;model=SHT40;kind=temperature;value=${temperature};unit=°C`,
    `make=Sensirion;model=SHT40;kind=humidity;value=${humidity};unit=%`,
  ].join(',')
}

export interface ShowcaseDevice {
  id: string
  played: PlayedDevice
  report: DeviceReport
}

async function connectNamed(api: InstanceApi, baseUrl: string, name: string, mac: string, model: string, report: DeviceReport): Promise<ShowcaseDevice> {
  const played = await connectDevice(baseUrl, { mac, model, firmwareVersion: '1.7.1' })
  const { id } = (await api.devices()).find(summary => summary.friendlyId === played.setup.friendly_id)!
  await api.updateDevice(id, { name })
  return { id, played, report }
}

async function pollTimes(device: ShowcaseDevice, times: number) {
  for (let poll = 0; poll < times; poll++)
    await device.played.display(device.report)
}

async function buildPollPlugin(api: InstanceApi, name: string, refreshInterval: number, dataSources: DataSourceInput[], templates: Partial<Record<TemplateSize, string>>) {
  const { id } = await api.createPlugin({ kind: 'Poll', name })
  return api.updatePlugin(id, { refreshInterval, dataSources, templates: templatesOf(templates) })
}

async function buildWebhookPlugin(api: InstanceApi, baseUrl: string, name: string, mergeStrategy: string, templates: Partial<Record<TemplateSize, string>>, payload: Record<string, unknown>) {
  const { id } = await api.createPlugin({ kind: 'Webhook', name, mergeStrategy })
  const plugin = await api.updatePlugin(id, { templates: templatesOf(templates) })
  // The webhook's own address is the Instance's public one, which does not resolve here.
  const response = await fetch(new URL(`api/webhook/${plugin.webhook!.token}`, baseUrl), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  if (!response.ok)
    throw new Error(`The webhook of ${name} answered ${response.status}: ${await response.text()}`)
  return plugin
}

export interface ShowcasePlugins {
  weather: PluginDetail
  departures: PluginDetail
  quote: PluginDetail
  waste: PluginDetail
  calendar: PluginDetail
  energy: PluginDetail
}

/** The Plugins of the household. The waste collection one fetches from a service on the home network that does not answer, so its fetches fail. */
export async function seedPlugins(api: InstanceApi, baseUrl: string): Promise<ShowcasePlugins> {
  return {
    weather: await buildPollPlugin(api, 'Weather', 30, [literal('forecast', WEATHER_FORECAST), literal('air', AIR_QUALITY)], WEATHER_TEMPLATES),
    departures: await buildPollPlugin(api, 'Tram departures', 5, [literal('transit', DEPARTURES)], DEPARTURES_TEMPLATES),
    quote: await buildPollPlugin(api, 'Quote of the day', 1440, [literal('quote', QUOTE)], QUOTE_TEMPLATES),
    waste: await buildPollPlugin(api, 'Waste collection', 1, [{ name: 'bins', mode: 'fetch', method: 'GET', url: 'http://waste.home.arpa/api/collections?street=Lindenstrasse', headers: { Accept: 'application/json' } }], WASTE_TEMPLATES),
    calendar: await buildWebhookPlugin(api, baseUrl, 'Family calendar', 'standard', CALENDAR_TEMPLATES, CALENDAR_PAYLOAD),
    energy: await buildWebhookPlugin(api, baseUrl, 'Energy today', 'deep_merge', ENERGY_TEMPLATES, ENERGY_PAYLOAD),
  }
}

/** A Device that polls once with a refresh rate of a minute and then never again, so it soon counts as offline. */
export async function seedBedroom(api: InstanceApi, baseUrl: string) {
  const bedroom = await connectNamed(api, baseUrl, 'Bedroom', 'A4:C1:38:2B:91:04', 'paper_s3', { 'battery-voltage': '3.86', 'rssi': '-71' })
  await api.updateDevice(bedroom.id, { refreshRate: 60 })
  await api.addHtmlScreen(bedroom.id, 'Good night', BEDTIME_HTML)
  await pollTimes(bedroom, 1)
  return bedroom
}

interface KitchenImages {
  fjord: Uint8Array
  tideChartUrl: string
}

/** The Device the screenshots dwell on: a Screen of every kind, a Schedule, Sleep Mode, Sensors and a Device Log. */
export async function seedKitchen(api: InstanceApi, baseUrl: string, plugins: ShowcasePlugins, images: KitchenImages) {
  const kitchen = await connectNamed(api, baseUrl, 'Kitchen', 'A4:C1:38:2B:91:01', 'og', { 'battery-voltage': '4.02', 'rssi': '-54', 'sensors': sensors(21.4, 46) })
  await api.updateDevice(kitchen.id, { refreshRate: 900, sleepStartTime: 23 * HOUR, sleepEndTime: 6 * HOUR, sleepModeEnabled: true })

  await api.addHtmlScreen(kitchen.id, 'Morning briefing', MORNING_BRIEFING_HTML)
  await api.assignPlugin(plugins.weather.id, kitchen.id)
  await api.addMashup(kitchen.id, 'Kitchen dashboard', '1Lx2R', [plugins.weather.id, plugins.departures.id, plugins.quote.id])
  const fjord = await api.addFileScreen(kitchen.id, 'Fjord at dawn', images.fjord)
  await api.addExternalScreen(kitchen.id, 'Tide chart', images.tideChartUrl)
  await api.assignPlugin(plugins.calendar.id, kitchen.id)

  // Every Screen is served once so each has an image, then Rotation goes on to the Mashup.
  await pollTimes(kitchen, 9)
  await api.schedule(fjord.id, { enabled: true, weekdays: [0, 6] })
  await seedKitchenLog(kitchen.played)
  return kitchen
}

export async function seedOffice(api: InstanceApi, baseUrl: string, plugins: ShowcasePlugins) {
  const office = await connectNamed(api, baseUrl, 'Office', 'A4:C1:38:2B:91:02', 'x', { 'battery-voltage': '3.14', 'rssi': '-63' })
  await api.addHtmlScreen(office.id, 'Office hours', OFFICE_HTML)
  await api.assignPlugin(plugins.energy.id, office.id)
  await api.assignPlugin(plugins.calendar.id, office.id)
  await api.assignPlugin(plugins.quote.id, office.id)
  // Once round the Order: the poll after the charge then serves the first Screen again.
  await pollTimes(office, 4)
  return office
}

export async function seedHallway(api: InstanceApi, baseUrl: string, plugins: ShowcasePlugins) {
  const hallway = await connectNamed(api, baseUrl, 'Hallway', 'A4:C1:38:2B:91:03', 'reterminal_e1001', { 'battery-voltage': '3.19', 'rssi': '-68' })
  await api.addHtmlScreen(hallway.id, 'Before you leave', HALLWAY_HTML)
  await api.assignPlugin(plugins.departures.id, hallway.id)
  await api.assignPlugin(plugins.waste.id, hallway.id)
  await api.assignPlugin(plugins.weather.id, hallway.id)
  await pollTimes(hallway, 5)
  return hallway
}

const MINUTE = 60

async function seedKitchenLog(kitchen: PlayedDevice) {
  const now = Math.floor(Date.now() / 1000)
  const status = (battery: number, rssi: number) => ({ wifi_signal: rssi, wifi_status: 'connected', battery_voltage: battery, free_heap_size: 148_220, wake_reason: 'timer', firmware_version: '1.7.1' })
  const entries = [
    { minutesAgo: 2, level: 'info', message: 'display poll, served Kitchen dashboard', ...status(4.02, -54) },
    { minutesAgo: 17, level: 'info', message: 'display poll, served Weather', ...status(4.02, -55) },
    { minutesAgo: 32, level: 'warn', message: 'wifi reconnect took 9 s', source_path: 'src/wifi.cpp', source_line: 204, ...status(4.03, -77) },
    { minutesAgo: 47, level: 'info', message: 'display poll, served Morning briefing', ...status(4.03, -56) },
    { minutesAgo: 62, level: 'error', message: 'image download failed, HTTP 502, retrying at the next poll', source_path: 'src/display.cpp', source_line: 171, ...status(4.03, -74), retry: 1 },
    { minutesAgo: 77, level: 'info', message: 'display poll, served Tide chart', ...status(4.04, -53) },
    { minutesAgo: 6 * 60, level: 'info', message: 'woke from Sleep Mode', ...status(4.05, -52) },
    { minutesAgo: 13 * 60, level: 'info', message: 'Sleep Mode until 06:00, refresh rate 25200 s', ...status(4.07, -52) },
    { minutesAgo: 14 * 60, level: 'debug', message: 'heap after render 148 kB', ...status(4.08, -51) },
    { minutesAgo: 20 * 60, level: 'info', message: 'firmware 1.7.1 installed, rebooting', source_path: 'src/ota.cpp', source_line: 96, ...status(4.11, -50) },
  ]
  await kitchen.log(entries.map(({ minutesAgo, ...entry }, index) => ({ id: 4100 + entries.length - index, created_at: now - minutesAgo * MINUTE, ...entry })))
}
