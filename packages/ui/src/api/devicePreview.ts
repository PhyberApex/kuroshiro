import type { DevicePreviewInput, DevicePreviewSignal } from 'kuroshiro-shared'
import { DEVICE_PREVIEW_SIGNAL_HEADER } from 'kuroshiro-shared'
import { apiSendForImageWithHeaders } from './client'

export interface DevicePreviewAnswer {
  blob: Blob
  signal: DevicePreviewSignal
}

/**
 * Draws the body HTML as the Device Model and Palette would (ADR-0040); nothing is stored. Refused with
 * `device-model-unknown`, `palette-unknown` or `palette-not-for-model` for an unknown or mismatched pair, and with
 * `device-preview-busy` while another device preview is already being drawn on this Instance.
 */
export async function devicePreview(input: DevicePreviewInput): Promise<DevicePreviewAnswer> {
  const { blob, headers } = await apiSendForImageWithHeaders('POST', 'device-preview', input)
  return { blob, signal: (headers.get(DEVICE_PREVIEW_SIGNAL_HEADER) as DevicePreviewSignal | null) ?? 'none' }
}
