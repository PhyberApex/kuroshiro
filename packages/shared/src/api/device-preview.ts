import type { RenderSignal } from './screens.ts'

/** What the device preview is drawn from: the browser preview's own body HTML, already Liquid-rendered. */
export interface DevicePreviewInput {
  html: string
  deviceModelName: string
  paletteId: string
  /** The Plugin being drawn; its Framework Version is used. Left out, the Instance pin is. */
  pluginId?: string
  /** Defaults to `true`. `false` converts with hard thresholds, as a Screen or Plugin with Dithering off does. */
  dither?: boolean
  /** The Plugin's screen modifiers (ADR-0054); left out, none. */
  noScreenPadding?: boolean
  darkMode?: boolean
}

/** The response header naming the Render Signal raised while the preview was drawn, or `none`. Nothing about it is stored (ADR-0040). */
export const DEVICE_PREVIEW_SIGNAL_HEADER = 'X-Render-Signal'

export type DevicePreviewSignal = RenderSignal | 'none'
