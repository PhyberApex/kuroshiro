import type { PluginDetail, PluginFieldRead } from 'kuroshiro-shared'
import type { PluginArrival } from './pluginArrival'
import type { NavItem } from '@/components/navItem'
import type { ProblemLine } from '@/components/problemLine'
import { devicePath } from '@/pages/devices/devicePaths'
import { possessive } from '@/pages/devices/screenNaming'
import { clockTime } from '@/patterns/time'
import { pluginPath } from './pluginPaths'
import { whereItShows } from './pluginRows'
import { listed } from './pluginWording'

const MINUTES_IN_HOUR = 60

const counted = (count: number, one: string, many: string) => count === 1 ? one : `${count} ${many}`

/** "every 15 minutes", "every hour", "every 2 hours": whole hours are said as hours. */
export function fetchInterval(minutes: number) {
  return minutes % MINUTES_IN_HOUR === 0
    ? `every ${counted(minutes / MINUTES_IN_HOUR, 'hour', 'hours')}`
    : `every ${counted(minutes, 'minute', 'minutes')}`
}

/** One part of the facts line. `at` is an instant the line shows as a relative time after the words. */
export interface PluginFact {
  text: string
  at?: string
}

const assignedDeviceNames = (plugin: PluginDetail) => plugin.assignments.map(assignment => assignment.deviceName)

function howItIsFed({ refreshInterval, webhook }: PluginDetail): PluginFact[] {
  if (!webhook)
    return refreshInterval === null ? [] : [{ text: `Fetches ${fetchInterval(refreshInterval)}` }]
  return [webhook.payloadReceivedAt ? { text: 'Last received', at: webhook.payloadReceivedAt } : { text: 'Nothing received yet' }]
}

/** The facts line under the title, in its Poll and its Webhook reading. */
export function pluginFacts(plugin: PluginDetail): PluginFact[] {
  return [
    { text: `${plugin.kind} Plugin` },
    ...howItIsFed(plugin),
    { text: whereItShows({ devices: plugin.assignments.map(assignment => ({ name: assignment.deviceName })), mashups: plugin.mashups }) },
    ...(plugin.recipe ? [{ text: `From the Recipe ${plugin.recipe.name ?? plugin.recipe.id}` }] : []),
  ]
}

const dataSourcePath = (plugin: PluginDetail, name: string) => ({ path: pluginPath(plugin.id), query: { source: name } })

function dataSourceProblems(plugin: PluginDetail): ProblemLine[] {
  return plugin.dataSources
    .filter(source => source.alertFiring || source.fetchFailureStreak > 0)
    .map((source) => {
      const link = { label: 'See the error', to: dataSourcePath(plugin, source.name) }
      return source.alertFiring
        ? { kind: 'alert', text: `Alert: the Data Source ${source.name} keeps failing`, link }
        : { kind: 'problem', text: `The last fetch of the Data Source ${source.name} failed.`, link }
    })
}

/** As the server decides `needsValues`: required, not a credit, without a Field Value and without a default. */
function isWaitingForValue(field: PluginFieldRead, { fieldValues }: PluginDetail) {
  const value = fieldValues[field.keyname]
  const stored = value !== undefined && (value.secret ? value.set : value.value !== null)
  return field.required && field.type !== 'author_bio' && !stored && !field.default
}

function emptyFieldsSentence(plugin: PluginDetail) {
  const labels = plugin.fields.filter(field => isWaitingForValue(field, plugin)).map(field => field.label || field.keyname)
  if (labels.length > 1)
    return `${labels.length} required Plugin Fields are empty: ${listed(labels)}. ${plugin.name} renders without them.`
  return `${labels.length === 1 ? `The required Plugin Field ${labels[0]}` : 'A required Plugin Field'} is empty. ${plugin.name} renders without it.`
}

function fieldValueProblems(plugin: PluginDetail): ProblemLine[] {
  return plugin.needsValues
    ? [{ kind: 'problem', text: emptyFieldsSentence(plugin), link: { label: 'Fill in the Field Values', to: { path: pluginPath(plugin.id), hash: '#values' } } }]
    : []
}

function renderProblems(plugin: PluginDetail): ProblemLine[] {
  const render = plugin.lastScheduledRender
  return render?.error
    ? [{ kind: 'problem', text: `The template could not be rendered at ${clockTime(new Date(render.at))}: ${render.error.message}`, link: { label: 'Open the template', to: { path: pluginPath(plugin.id), hash: '#template' } } }]
    : []
}

/** What is wrong with the Plugin, each line with where it is fixed. Nothing wrong is no line at all. */
export function pluginProblems(plugin: PluginDetail): ProblemLine[] {
  return [...dataSourceProblems(plugin), ...fieldValueProblems(plugin), ...renderProblems(plugin)]
}

/** A line shown once: what just happened, and for a Plugin that was assigned on the way, the link back to that Device. */
export interface OnceLine {
  text: string
  back?: NavItem
}

const BRINGS_TRANSFORM = 'It brings a transform: JavaScript that runs on this server at every fetch. Read it under Data Sources.'

const updateItems = (count: number) => counted(count, '1 Update Item', 'Update Items')

function whatHappened(arrival: PluginArrival): string {
  switch (arrival.how) {
    case 'created':
      return 'Created. It shows its name until you write its template.'
    case 'duplicated':
      return `A copy of ${arrival.source}.`
    case 'imported':
      return `Imported from ${arrival.origin === 'recipe' ? `the Recipe ${arrival.name}` : arrival.name}.`
    case 'applied':
      return `Applied ${updateItems(arrival.updateItems)} from the Recipe ${arrival.recipe}.`
    case 'skipped':
      return `Skipped ${updateItems(arrival.updateItems)} from the Recipe ${arrival.recipe}.`
  }
}

/** A Recipe Update Check runs on a Plugin that was already there, so where it shows is no news. */
function whereItIs(arrival: PluginArrival) {
  if (arrival.device)
    return [`Assigned to ${arrival.device.name}.`]
  return arrival.how === 'applied' || arrival.how === 'skipped' ? [] : ['It is not on a Device yet.']
}

export function arrivalLine(arrival: PluginArrival): OnceLine {
  const transform = arrival.how === 'imported' && arrival.hasTransform ? [BRINGS_TRANSFORM] : []
  return {
    text: [whatHappened(arrival), ...whereItIs(arrival), ...transform].join(' '),
    back: arrival.device && { label: `Back to ${possessive(arrival.device.name)} Screens`, to: devicePath(arrival.device.id) },
  }
}

export function savedLine(at: Date, plugin: PluginDetail): OnceLine {
  const devices = assignedDeviceNames(plugin)
  const saved = `Saved at ${clockTime(at)}.`
  return { text: devices.length === 0 ? saved : `${saved} Fetching and rendering again for ${listed(devices)}.` }
}

/** The paragraph of the tucked section "Duplicate, export or delete {Plugin}", in its Poll and its Webhook wording. */
export function actionsParagraph(plugin: PluginDetail) {
  const devices = assignedDeviceNames(plugin)
  const [copied, exported] = plugin.kind === 'Webhook'
    ? ['the same template, Merge Strategy, Plugin Fields and Field Values, on no Device, with its own Webhook URL', 'the template and the Plugin Fields, without Field Values']
    : ['the same template, Data Sources, Plugin Fields and Field Values, on no Device', 'the template, the Data Sources as written, headers included, and the Plugin Fields, without Field Values']
  const removedFrom = devices.length === 0 ? 'this Instance' : `this Instance and from ${listed(devices)}`
  return `A duplicate is a second Plugin with ${copied}. An export is a .zip with ${exported}. Deleting removes ${plugin.name} from ${removedFrom}.`
}
