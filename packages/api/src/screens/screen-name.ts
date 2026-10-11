import type { Plugin } from '../plugins/entities/plugin.entity.js'
import type { Screen } from './screens.entity.js'

/** A Screen's name: a Plugin Screen takes its Plugin's name, every other kind its filename. */
export function screenNameOf(screen: Pick<Screen, 'type' | 'filename'> & { plugin?: Pick<Plugin, 'name'> | null }): string {
  return (screen.type === 'plugin' ? screen.plugin?.name : screen.filename) ?? ''
}
