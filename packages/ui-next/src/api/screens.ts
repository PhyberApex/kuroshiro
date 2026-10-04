import type { ReorderScreensInput, ScreenRead, UpdateMashupInput, UpdateScreenInput } from 'kuroshiro-shared'
import { apiGet, apiSend, apiSendForImage } from './client'

/** A Device's Screens in Order, each with its Screen State. */
export function listScreens(deviceId: string) {
  return apiGet<ScreenRead[]>(`devices/${deviceId}/screens`)
}

export function reorderScreens(deviceId: string, input: ReorderScreensInput) {
  return apiSend<ScreenRead[]>('PUT', `devices/${deviceId}/screens/order`, input)
}

/** Refused with `screen-field-not-for-kind` for a field the Screen's kind does not have, and with `image-fetch-failed` when a kept image's new address gives no image; the earlier image and address then stay. */
export function updateScreen(screenId: string, input: UpdateScreenInput) {
  return apiSend<ScreenRead>('PATCH', `screens/${screenId}`, input)
}

function asUpload(file: File) {
  const upload = new FormData()
  upload.append('file', file)
  return upload
}

/** The file converted as the Screen's Device would show it. Nothing is stored. Refused with `image-unreadable`, `upload-too-large` or `demo-mode`. */
export function previewScreenImage(screenId: string, file: File) {
  return apiSendForImage('POST', `screens/${screenId}/image-preview`, asUpload(file))
}

/** Replaces a File Screen's image; the Screen keeps its id, name, Order and Schedule. Refused like the preview. */
export function replaceScreenImage(screenId: string, file: File) {
  return apiSend<ScreenRead>('PUT', `screens/${screenId}/image`, asUpload(file))
}

/** Fetches a kept External link image again. Refused with `image-fetch-failed`, and the earlier image stays. */
export function refreshScreen(screenId: string) {
  return apiSend<ScreenRead>('POST', `screens/${screenId}/refresh`)
}

/** Deletes any Screen but a Plugin Screen, which is unassigned. The Screens after it move up in the Order. */
export function deleteScreen(screenId: string) {
  return apiSend('DELETE', `screens/${screenId}`)
}

/** Takes the whole slot list of the Mashup Screen, in slot order, with or without another layout. */
export function updateMashup(screenId: string, input: UpdateMashupInput) {
  return apiSend<ScreenRead>('PATCH', `mashup/${screenId}`, input)
}

/** Removes the Plugin's Screen from the Device; the Plugin itself stays. */
export function unassignPlugin(pluginId: string, deviceId: string) {
  return apiSend('DELETE', `plugins/${pluginId}/assignments/${deviceId}`)
}
