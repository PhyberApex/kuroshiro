import type { ReorderScreensInput, ScreenRead } from 'kuroshiro-shared'
import { apiGet, apiSend } from './client'

/** A Device's Screens in Order, each with its Screen State. */
export function listScreens(deviceId: string) {
  return apiGet<ScreenRead[]>(`devices/${deviceId}/screens`)
}

export function reorderScreens(deviceId: string, input: ReorderScreensInput) {
  return apiSend<ScreenRead[]>('PUT', `devices/${deviceId}/screens/order`, input)
}
