import type { PluginKind } from './plugins'

export type ScreenKind = 'plugin' | 'mashup' | 'external' | 'file' | 'html'

export type ScreenState = 'active' | 'upNext' | 'scheduleOff' | 'notToday' | 'notThisHour' | 'skipping'

/** Which part of a Schedule leaves today out, for the Screen State `notToday`. */
export type ScreenStateCause = 'weekday' | 'dateRange'

export type RenderSignal = 'skip' | 'hold'

export const TEMPLATE_SIZES = ['full', 'half_horizontal', 'half_vertical', 'quadrant'] as const
export type TemplateSize = typeof TEMPLATE_SIZES[number]

/** The Mashup layouts, each with its slots in slot order. */
export const MASHUP_LAYOUTS = [
  {
    id: '1Lx1R',
    slots: [
      { position: 'left', size: 'half_vertical' },
      { position: 'right', size: 'half_vertical' },
    ],
  },
  {
    id: '1Tx1B',
    slots: [
      { position: 'top', size: 'half_horizontal' },
      { position: 'bottom', size: 'half_horizontal' },
    ],
  },
  {
    id: '1Lx2R',
    slots: [
      { position: 'left', size: 'half_vertical' },
      { position: 'top-right', size: 'quadrant' },
      { position: 'bottom-right', size: 'quadrant' },
    ],
  },
  {
    id: '2Lx1R',
    slots: [
      { position: 'top-left', size: 'quadrant' },
      { position: 'bottom-left', size: 'quadrant' },
      { position: 'right', size: 'half_vertical' },
    ],
  },
  {
    id: '2Tx1B',
    slots: [
      { position: 'top-left', size: 'quadrant' },
      { position: 'top-right', size: 'quadrant' },
      { position: 'bottom', size: 'half_horizontal' },
    ],
  },
  {
    id: '1Tx2B',
    slots: [
      { position: 'top', size: 'half_horizontal' },
      { position: 'bottom-left', size: 'quadrant' },
      { position: 'bottom-right', size: 'quadrant' },
    ],
  },
  {
    id: '2x2',
    slots: [
      { position: 'top-left', size: 'quadrant' },
      { position: 'top-right', size: 'quadrant' },
      { position: 'bottom-left', size: 'quadrant' },
      { position: 'bottom-right', size: 'quadrant' },
    ],
  },
] as const satisfies ReadonlyArray<{ id: string, slots: ReadonlyArray<{ position: string, size: TemplateSize }> }>

export type MashupLayout = typeof MASHUP_LAYOUTS[number]['id']

export interface ScheduleRead {
  id: string
  enabled: boolean
  /** 0 is Sunday. `null` or empty means every day. */
  weekdays: number[] | null
  /** `HH:MM` in the server's timezone. */
  startTime: string | null
  endTime: string | null
  /** `YYYY-MM-DD` in the server's timezone. */
  startDate: string | null
  endDate: string | null
}

export interface ScreenPluginReference {
  id: string
  name: string
  kind: PluginKind
  requiredFieldEmpty: boolean
  fetchAlertFiring: boolean
}

export interface MashupSlotRead {
  position: string
  size: TemplateSize
  pluginId: string
  pluginName: string
}

export interface ScreenRead {
  id: string
  deviceId: string
  kind: ScreenKind
  /** A Plugin Screen has no name of its own and reads its Plugin's. */
  name: string
  order: number
  /** `null` on a mirrored Device, and for a Screen waiting its turn. */
  state: ScreenState | null
  /** Set only with the state `notToday`. */
  stateCause: ScreenStateCause | null
  renderSignal: RenderSignal | null
  /** `null` until the Screen has been rendered. */
  imagePath: string | null
  renderedAt: string | null
  schedule: ScheduleRead | null
  plugin: ScreenPluginReference | null
  mashup: { layout: MashupLayout, slots: MashupSlotRead[] } | null
  external: { url: string, fetchManual: boolean } | null
  file: { originalName: string | null, width: number | null, height: number | null, bytes: number | null, uploadedAt: string | null } | null
  html: string | null
}

/** The kinds `POST /api/screens` creates; a Mashup and a Plugin Assignment have their own endpoints. */
export const CREATABLE_SCREEN_KINDS = ['external', 'file', 'html'] as const satisfies readonly ScreenKind[]

interface CreateScreenBase {
  deviceId: string
  name: string
}

export interface CreateExternalScreenInput extends CreateScreenBase {
  kind: 'external'
  /** `http` or `https`. */
  url: string
  /** `true` keeps the image fetched at creation; `false` fetches it at every turn. */
  fetchManual: boolean
}

/** Sent as `multipart/form-data` with the image in the part `file`. */
export interface CreateFileScreenInput extends CreateScreenBase {
  kind: 'file'
}

export interface CreateHtmlScreenInput extends CreateScreenBase {
  kind: 'html'
  html: string
}

export type CreateScreenInput = CreateExternalScreenInput | CreateFileScreenInput | CreateHtmlScreenInput

export interface CreateMashupInput {
  deviceId: string
  name: string
  layout: MashupLayout
  /** One Plugin per slot of the layout, in slot order. */
  pluginIds: string[]
}

export interface AssignPluginInput {
  deviceId: string
}

export interface ReorderScreensInput {
  /** Every Screen of the Device, once, in the new Order. */
  screenIds: string[]
}

/** Each field belongs to some kinds only; a field the Screen's kind does not have answers 400 `screen-field-not-for-kind`. */
export interface UpdateScreenInput {
  /** Every kind but a Plugin Screen, which reads its Plugin's name. */
  name?: string
  /** External link only, `http` or `https`. A new one is fetched and converted first when the image is kept. */
  url?: string
  /** External link only. Switching to `true` fetches and converts the image first. */
  fetchManual?: boolean
  /** HTML Screen only. */
  html?: string
}

export interface UpdateMashupInput {
  /** Defaults to the Mashup's current layout. */
  layout?: MashupLayout
  /** The whole slot list for the layout, in slot order. */
  pluginIds: string[]
}
