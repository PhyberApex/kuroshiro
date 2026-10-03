import type { Plugin } from './entities/plugin.entity.js'

/** A Poll-kind Plugin renders from its Template alone: without Data Sources it sees `trmnl` and its Field Values. */
export function pollPluginRenders(plugin: Pick<Plugin, 'kind' | 'templates'>): boolean {
  return plugin.kind === 'Poll' && !!plugin.templates?.length
}
