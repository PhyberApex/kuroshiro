import { resolveAppPath } from '../utils/pathHelper'

export function firmwareFilePath(id: string): string {
  return resolveAppPath('public', 'firmware', `${id}.bin`)
}

export function firmwareFileUrl(id: string, apiUrl: string): string {
  return `${apiUrl}/firmware/${id}.bin`
}
