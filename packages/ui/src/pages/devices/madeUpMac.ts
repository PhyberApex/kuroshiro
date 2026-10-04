const hexPair = (byte: number) => byte.toString(16).padStart(2, '0').toUpperCase()

/** A random MAC address, for a Device that has no real one. */
export function madeUpMac() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  // Locally administered and unicast: the range no manufacturer assigns, so a made-up address never is a real Device's.
  bytes[0] = (bytes[0]! & 0xFC) | 0x02
  return [...bytes].map(hexPair).join(':')
}
