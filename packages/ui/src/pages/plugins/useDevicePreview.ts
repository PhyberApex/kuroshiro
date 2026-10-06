import type { DevicePreviewSignal } from 'kuroshiro-shared'
import { shallowRef, watch } from 'vue'
import { isRefusal } from '@/api/client'
import { devicePreview } from '@/api/devicePreview'

/** What the device preview is drawn from and at what size; any change to this drops a drawing back to the live browser one. */
export interface DevicePreviewSource {
  html: string
  deviceModelName: string
  paletteId: string
  width: number
  height: number
}

/** The Device Model and Palette a device preview is drawn for, as both callers (the Template editor and Edit HTML) already hold it. */
export interface DevicePreviewTarget {
  model: { name: string, width: number, height: number }
  palette: { id: string }
}

/** Builds the source from a target and the body HTML already drawn for it, so both callers assemble it the same way. */
export function devicePreviewSourceOf(target: DevicePreviewTarget, html: string): DevicePreviewSource {
  return { html, deviceModelName: target.model.name, paletteId: target.palette.id, width: target.model.width, height: target.model.height }
}

export type DevicePreviewState
  = | { status: 'idle' }
    | { status: 'drawing' }
    | { status: 'drawn', document: string, signal: DevicePreviewSignal, drawnAt: Date }
    | { status: 'busy' }
    | { status: 'failed' }

function imageDocument(dataUrl: string, width: number, height: number): string {
  return `<html><body style="margin:0"><img src="${dataUrl}" width="${width}" height="${height}" style="display:block"></body></html>`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * The device preview's own drawing (ADR-0040): drawn only on request, as the PNG the chosen Device Model and
 * Palette would get. `source` changing — the Template or HTML, a Field Value, the fetched data, or the chosen
 * Device, Device Model or Palette — drops it back to `idle`, the live browser drawing, whether or not a draw
 * already under way would still land.
 */
export function useDevicePreview(source: () => DevicePreviewSource | undefined) {
  const state = shallowRef<DevicePreviewState>({ status: 'idle' })
  let current = 0

  watch(source, (now, before) => {
    if (JSON.stringify(now) !== JSON.stringify(before)) {
      current++
      state.value = { status: 'idle' }
    }
  })

  async function draw() {
    const input = source()
    if (!input)
      return
    const mine = ++current
    state.value = { status: 'drawing' }
    try {
      const { blob, signal } = await devicePreview(input)
      if (mine !== current)
        return
      const document = imageDocument(await blobToDataUrl(blob), input.width, input.height)
      state.value = { status: 'drawn', document, signal, drawnAt: new Date() }
    }
    catch (error) {
      if (mine !== current)
        return
      state.value = { status: isRefusal(error, 'device-preview-busy') ? 'busy' : 'failed' }
    }
  }

  function backToBrowser() {
    current++
    state.value = { status: 'idle' }
  }

  return { state, draw, backToBrowser }
}
