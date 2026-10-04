import { PLUGINS_PATH } from '@/shell/barEntries'

export { PLUGINS_PATH }

export const pluginPath = (pluginId: string) => `${PLUGINS_PATH}/${pluginId}`

export type AddPluginWay = 'recipe' | 'file' | 'github' | 'poll' | 'webhook'

/** Add a Plugin, with one of its ways chosen. */
export const addPluginPath = (way: AddPluginWay) => `${PLUGINS_PATH}/new?way=${way}`
