import { randomUUID } from 'node:crypto'

export default function () {
  // Remove hyphens from UUID
  const cleanUuid = randomUUID().replace(/-/g, '')

  // Convert hex string to byte array
  const hexPairs = cleanUuid.match(/.{1,2}/g) || []
  const byteArray = new Uint8Array(hexPairs.map(hex => Number.parseInt(hex, 16)))

  // Convert to Base64
  const base64 = btoa(String.fromCharCode.apply(null, byteArray))

  // Make URL-safe by replacing + with - and / with _
  const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_')

  // Remove padding (=) characters
  const withoutPadding = urlSafe.replace(/=+$/, '')

  // Truncate to 22 characters
  return withoutPadding.substring(0, 6)
}
