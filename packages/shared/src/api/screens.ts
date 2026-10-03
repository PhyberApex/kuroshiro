import type { PluginKind } from './plugins'

export type ScreenKind = 'plugin' | 'mashup' | 'external' | 'file' | 'html'

export type ScreenState = 'active' | 'upNext' | 'scheduleOff' | 'notToday' | 'notThisHour' | 'skipping'

/** Which part of a Schedule leaves today out, for the Screen State `notToday`. */
export type ScreenStateCause = 'weekday' | 'dateRange'

export type RenderSignal = 'skip' | 'hold'

export type TemplateSize = 'full' | 'half_horizontal' | 'half_vertical' | 'quadrant'

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
