import { PLUGINS_PATH } from '@/shell/barEntries'

export { PLUGINS_PATH }

export const pluginPath = (pluginId: string) => `${PLUGINS_PATH}/${pluginId}`

export type AddPluginWay = 'recipe' | 'file' | 'github' | 'poll' | 'webhook'

/** Add a Plugin, with one of its ways chosen. With a Device, the new Plugin is assigned to it once it exists. */
export function addPluginPath(way: AddPluginWay, deviceId?: string) {
  return `${PLUGINS_PATH}/new?way=${way}${deviceId ? `&device=${encodeURIComponent(deviceId)}` : ''}`
}

export const recipeUpdatePath = (pluginId: string) => `${pluginPath(pluginId)}/update`
