import { randomUUID } from 'node:crypto'

export default function randomUrlSafeToken(length: number) {
  return Buffer.from(randomUUID().replace(/-/g, ''), 'hex').toString('base64url').slice(0, length)
}
