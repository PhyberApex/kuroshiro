import type { DeviceDetail, ScreenKind, ScreenPluginReference, ScreenRead } from 'kuroshiro-shared'
import type { Sentence } from './sentence'
import { formatBytes } from '@/components/fileRules'
import { pluginPath } from '@/pages/plugins/pluginPaths'
import { listed } from '@/patterns/listed'
import { clockTime, exactTime, relativeTime } from '@/patterns/time'
import { possessive, screenName } from './screenNaming'
import { linkTo, sentence } from './sentence'

const UPLOAD_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const startOfSentence = (words: string) => words.charAt(0).toUpperCase() + words.slice(1)

/** What a Device's images are made for: "TRMNL OG, Greyscale". Empty for a Device with neither a Device Model nor a Palette. */
export function rendersFor(device: Pick<DeviceDetail, 'deviceModel' | 'palette'>) {
  return [device.deviceModel?.label, device.palette?.name].filter(Boolean).join(', ')
}

/** "1600 × 960 · 412 KB · uploaded 12 September 2026. Converted for TRMNL OG, Greyscale." A Screen uploaded before the facts were kept has only some of them. */
export function fileFacts(file: NonNullable<ScreenRead['file']>, device: Pick<DeviceDetail, 'deviceModel' | 'palette'>) {
  const facts = [
    file.width !== null && file.height !== null ? `${file.width} × ${file.height}` : undefined,
    file.bytes !== null ? formatBytes(file.bytes) : undefined,
    file.uploadedAt ? `uploaded ${UPLOAD_DAY.format(new Date(file.uploadedAt))}` : undefined,
  ].filter(fact => fact !== undefined)
  const convertedFor = rendersFor(device)
  return [
    facts.length > 0 ? `${startOfSentence(facts.join(' · '))}.` : undefined,
    convertedFor ? `Converted for ${convertedFor}.` : undefined,
  ].filter(Boolean).join(' ')
}

function lastRendered(renderedAt: string, now: Date) {
  const at = new Date(renderedAt)
  return relativeTime(at, now) ? `, last at ${clockTime(at)}` : `, last on ${exactTime(at)}`
}

export function pluginRenderedSentence(plugin: ScreenPluginReference, renderedAt: string | null, now: Date): Sentence {
  return sentence(
    'Rendered from the Plugin ',
    linkTo(plugin.name, pluginPath(plugin.id)),
    `${renderedAt ? lastRendered(renderedAt, now) : ''}.`,
  )
}

export interface RemovalWording {
  /** The button's name, which the confirming button repeats. */
  action: string
  title: string
  lost: string
  stays: string
}

const LOST_WITH_THE_SCREEN: Record<Exclude<ScreenKind, 'plugin'>, string> = {
  file: 'the uploaded image',
  mashup: 'the Mashup\'s layout',
  html: 'the HTML written for it',
  external: 'the link',
}

/** A Plugin Assignment is unassigned; every other Screen is deleted. */
export function removalWording(screen: Pick<ScreenRead, 'kind' | 'name' | 'plugin'>, device: Pick<DeviceDetail, 'name'>): RemovalWording {
  const name = screenName(screen.name)
  if (screen.kind === 'plugin' && screen.plugin) {
    return {
      action: 'Unassign Plugin',
      title: `Unassign ${name} from ${device.name}?`,
      lost: `This Screen on ${device.name} and its Schedule.`,
      stays: `The Plugin ${name}, with its template, its Data Sources and its place in any Mashup.`,
    }
  }
  return {
    action: 'Delete Screen',
    title: `Delete ${name}?`,
    lost: screen.kind === 'plugin' ? 'The Screen and its Schedule.' : `The Screen, its Schedule and ${LOST_WITH_THE_SCREEN[screen.kind]}.`,
    stays: screen.kind === 'mashup' ? 'The Plugins in its slots.' : `${possessive(device.name)} other Screens, which move up in the Order.`,
  }
}

export function isWebAddress(address: string) {
  return /^https?:\/\/\S+$/i.test(address.trim())
}

export function noSlotLine(pluginNames: string[]) {
  return pluginNames.length === 1
    ? `${pluginNames[0]} no longer has a slot. The Plugin itself stays.`
    : `${listed(pluginNames)} no longer have a slot. The Plugins themselves stay.`
}
