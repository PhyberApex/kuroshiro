import type { Plugin } from './entities/plugin.entity.js'
import { templateOfSize } from './plugin-templates.js'

/** A Poll-kind Plugin renders from its Template alone: without Data Sources it sees `trmnl` and its Field Values. */
export function isRenderablePollPlugin(plugin: Pick<Plugin, 'kind' | 'templates'>): boolean {
  return plugin.kind === 'Poll' && !!templateOfSize(plugin.templates, 'full')
}
