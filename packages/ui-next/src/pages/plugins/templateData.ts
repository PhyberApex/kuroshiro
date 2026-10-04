import type { PreviewData, PreviewName, ScheduledRenderRead, TemplateSize } from 'kuroshiro-shared'
import { possessive } from '@/pages/devices/screenNaming'
import { clockTime } from '@/patterns/time'

/** One name the Template can read, as a row of "Data". */
export interface DataRow {
  name: string
  /** Where it comes from: "Data Source", "Kitchen's Sensors". */
  origin: string
  /** A Data Source the preview could not fetch: the Template reads its error marker. */
  notFetched: boolean
  /** A plain value, or an object or list with nothing in it, as JSON: shown in the row. */
  value?: string
  /** An object or a list as JSON, which the row opens to. */
  code?: string
  /** What is said above the code of a Data Source that was not fetched. */
  why?: string
}

const endedOnce = (sentence: string) => `${sentence.replace(/\.$/, '')}.`

function originOf({ origin, error }: PreviewName, deviceName: string | null) {
  switch (origin) {
    case 'fieldValue': return 'Field Value'
    case 'dataSource': return error === null ? 'Data Source' : 'Data Source, not fetched'
    case 'webhookPayload': return 'Webhook Payload'
    case 'sensors': return deviceName === null ? 'No Device, so no Sensors' : `${possessive(deviceName)} Sensors`
    case 'trmnl': return 'Kuroshiro'
  }
}

const opens = (value: unknown) => typeof value === 'object' && value !== null && Object.keys(value).length > 0

/** The rows of "Data", in the order the server names them. `deviceName` is the Device the preview is for, if any. */
export function dataRowsOf({ context, names }: PreviewData, deviceName: string | null): DataRow[] {
  if (Array.isArray(context))
    return []
  return names.map((named) => {
    const value = context[named.name]
    return {
      name: named.name,
      origin: originOf(named, deviceName),
      notFetched: named.error !== null,
      value: opens(value) ? undefined : JSON.stringify(value ?? null),
      code: opens(value) ? JSON.stringify(value, null, 2) : undefined,
      why: named.error === null
        ? undefined
        : `The preview's fetch failed: ${endedOnce(named.error)} The template reads an error marker in place of the data, as it would on the Device.`,
    }
  })
}

export const namesCount = (count: number) => count === 1 ? '1 name' : `${count} names`

/** The Data Sources the preview could not fetch, each with the server's reason as a sentence. */
export function unfetchedSources({ names }: PreviewData) {
  return names.flatMap(({ name, error }) => error === null ? [] : [{ name, reason: endedOnce(error) }])
}

export interface ScheduledFailure {
  /** "The scheduled render at 07:30 failed at line 3: ", which the server's message follows. */
  before: string
  message: string
  line: number | null
  /** The Template that failed. */
  size: TemplateSize
}

/** What the section says while the last scheduled render is a failed one. */
export function scheduledFailure(render: ScheduledRenderRead | null): ScheduledFailure | undefined {
  if (!render?.error)
    return undefined
  const { message, line, size } = render.error
  const where = line === null ? '' : ` at line ${line}`
  return { before: `The scheduled render at ${clockTime(new Date(render.at))} failed${where}: `, message, line, size }
}
