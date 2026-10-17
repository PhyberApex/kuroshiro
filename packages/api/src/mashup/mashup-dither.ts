import type { MashupConfiguration } from './entities/mashup-configuration.entity.js'

/** A Mashup stores no Dithering: it is undithered only when every slot's Plugin is, and an empty Mashup is dithered. */
export function mashupDither(configuration: Pick<MashupConfiguration, 'slots'>): boolean {
  const slots = configuration.slots ?? []
  return slots.length === 0 || slots.some(slot => slot.plugin.dither)
}
