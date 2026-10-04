import type { PluginImportOrigin } from 'kuroshiro-shared'
import type { Router } from 'vue-router'
import { pluginPath } from './pluginPaths'

/** The Device a Plugin was assigned to by the action that opened its page. */
interface AssignedDevice {
  id: string
  name: string
}

/**
 * What just happened to a Plugin, handed to its page by the page that opens it after an
 * action. The Plugin page words it as a line shown once.
 */
export type PluginArrival = (
  | { how: 'created' }
  /** `source` is the name of the Plugin it is a copy of. */
  | { how: 'duplicated', source: string }
  /** `name` is the Recipe's name, the file's name or `owner/repository`. */
  | { how: 'imported', origin: PluginImportOrigin['type'], name: string, hasTransform: boolean }
  /** After a Recipe Update Check: how many Update Items were applied or skipped, and the Recipe's name. */
  | { how: 'applied', updateItems: number, recipe: string }
  | { how: 'skipped', updateItems: number, recipe: string }
) & { device?: AssignedDevice }

// Held in memory and never in the address or the history, so that a reload shows no line.
let pending: { pluginId: string, arrival: PluginArrival } | undefined

/** Opens the Plugin's page after an action, carrying what the action was. */
export function openPluginPage(router: Router, pluginId: string, arrival: PluginArrival) {
  pending = { pluginId, arrival }
  return router.push(pluginPath(pluginId))
}

/** What the Plugin's page was opened with, once: the next call answers nothing. */
export function takePluginArrival(pluginId: string): PluginArrival | undefined {
  const arrival = pending?.pluginId === pluginId ? pending.arrival : undefined
  if (arrival)
    pending = undefined
  return arrival
}
