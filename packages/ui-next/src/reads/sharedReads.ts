import type { AlertsList, DeviceSummary, InstanceFacts } from 'kuroshiro-shared'
import type { App, InjectionKey } from 'vue'
import type { Load } from '@/patterns/useLoad'
import { computed, effectScope, inject } from 'vue'
import { listAlerts } from '@/api/alerts'
import { listDevices } from '@/api/devices'
import { getInstanceFacts } from '@/api/instance'
import { useLoad } from '@/patterns/useLoad'

interface SharedReads {
  instanceFacts: () => Load<InstanceFacts>
  devices: () => Load<DeviceSummary[]>
  alerts: () => Load<AlertsList>
}

const sharedReadsKey: InjectionKey<SharedReads> = Symbol('shared reads')

/**
 * The three reads every page may lean on, each made once for the whole app and started by
 * its first use: the Instance facts, loaded once, and the Devices and the Alerts, kept fresh.
 */
export const sharedReads = {
  install(app: App) {
    const scope = effectScope(true)
    const startedOnce = <T>(start: () => Load<T>) => {
      let load: Load<T> | undefined
      return () => load ??= scope.run(start)!
    }
    app.provide(sharedReadsKey, {
      instanceFacts: startedOnce(() => useLoad(getInstanceFacts)),
      devices: startedOnce(() => useLoad(listDevices, { fresh: true })),
      alerts: startedOnce(() => useLoad(() => listAlerts(), { fresh: true })),
    })
    app.onUnmount(() => scope.stop())
  },
}

function useSharedReads() {
  const reads = inject(sharedReadsKey)
  if (!reads)
    throw new Error('The shared reads are not installed: mount with mountApp or mountPage, which install them as main.ts does.')
  return reads
}

/** The Instance facts: version, server address, timezone, demo mode, Notifications, upload limits. */
export function useInstanceFacts() {
  return useSharedReads().instanceFacts()
}

/** Every Device, by name. After a write that changes a Device's name or adds or deletes one, call its `reload()`. */
export function useDevices() {
  return useSharedReads().devices()
}

/** The Alerts of the whole Instance: `data.active` are the firing ones. */
export function useAlerts() {
  return useSharedReads().alerts()
}

/** The name of the server's timezone ("Europe/Berlin"), which a Schedule's and Sleep Mode's hours are in. */
export function useServerTimezone() {
  const facts = useInstanceFacts()
  return computed(() => facts.data?.timezone)
}
