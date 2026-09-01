import { join } from 'node:path'
import process from 'node:process'

export function resolveAppPath(...segments: string[]) {
  if (process.env.NODE_ENV === 'production')
    return join(import.meta.dirname, '..', ...segments)
  return join(import.meta.dirname, '..', '..', ...segments)
}
