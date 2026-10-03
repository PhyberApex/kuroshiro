import type { DeviceDetail } from 'kuroshiro-shared'
import type { ComputedRef, InjectionKey } from 'vue'
import type { Load } from '@/patterns/useLoad'
import { inject, provide } from 'vue'

/** What the Device frame hands every page under it. */
export interface DeviceFrame {
  /** The Device of the route, loaded once for all its pages and kept fresh. After a write that changes it, call its `reload()`. */
  device: Load<DeviceDetail>
  /** The Device's name, known from the Devices list before the Device itself has loaded. */
  name: ComputedRef<string>
  /** The path of the Device's Screens view, which the paths of its other pages start with. */
  path: ComputedRef<string>
}

const deviceFrameKey: InjectionKey<DeviceFrame> = Symbol('Device frame')

export function provideDeviceFrame(frame: DeviceFrame) {
  provide(deviceFrameKey, frame)
}

export function useDeviceFrame() {
  const frame = inject(deviceFrameKey)
  if (!frame)
    throw new Error('A Device page stands under the Device frame: make its route a child of `/devices/:deviceId`.')
  return frame
}
