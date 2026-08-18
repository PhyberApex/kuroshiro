import type { Device } from '../types'

export const DEFAULT_RENDER_SIZE = { width: 800, height: 480 }

/** Pixel size images are generated at for a device; unassigned devices render as a TRMNL OG. */
export function deviceRenderSize(device: Pick<Device, 'deviceModel'> | null | undefined): { width: number, height: number } {
  const model = device?.deviceModel
  return model ? { width: model.width, height: model.height } : DEFAULT_RENDER_SIZE
}
