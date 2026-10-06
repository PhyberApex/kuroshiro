import type { RenderSignal } from './screens.ts'

/** What the device preview is drawn from: the browser preview's own body HTML, already Liquid-rendered. */
export interface DevicePreviewInput {
  html: string
  deviceModelName: string
  paletteId: string
}

/** The response header naming the Render Signal raised while the preview was drawn, or `none`. Nothing about it is stored (ADR-0040). */
export const DEVICE_PREVIEW_SIGNAL_HEADER = 'X-Render-Signal'

export type DevicePreviewSignal = RenderSignal | 'none'
