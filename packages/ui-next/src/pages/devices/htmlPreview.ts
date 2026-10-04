import type { DeviceDetail, DeviceModelRead, PaletteRead, ScreenShellTarget } from 'kuroshiro-shared'
import { viewFull, wrapInScreenShell } from 'kuroshiro-shared'

/** What the server sizes and classes a Device's Screens by, or nothing for a Device whose Device Model or Palette this Instance does not hold. */
export function shellTargetOf(device: Pick<DeviceDetail, 'deviceModel' | 'palette'>, models: DeviceModelRead[], palettes: PaletteRead[]) {
  const model = models.find(known => known.name === device.deviceModel?.name)
  const palette = palettes.find(known => known.id === device.palette?.id)
  return model && palette && { model, palette }
}

/** The document the server renders an HTML Screen's image from: its markup as a full view in the screen shell. */
export function htmlScreenDocument(target: ScreenShellTarget, html: string) {
  return wrapInScreenShell(target, viewFull(html))
}
