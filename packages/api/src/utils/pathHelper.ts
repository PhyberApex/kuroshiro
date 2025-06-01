import { join } from 'node:path'
import process from 'node:process'

export function resolveAppPath(...segments: string[]) {
  if (process.env.NODE_ENV === 'production')
    return join(__dirname, '..', ...segments)
  return join(__dirname, '..', '..', ...segments)
}
