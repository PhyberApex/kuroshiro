import type { MergeStrategy, PluginKind } from 'kuroshiro-shared'
import type { PluginDataSourceDto } from './dto/plugin-data-source.dto.js'
import type { PluginFieldDto } from './dto/plugin-field.dto.js'
import type { RecipeSnapshot } from './entities/plugin.entity.js'

export interface PluginTemplateInput {
  layout?: string
  liquidMarkup: string
}

/**
 * Everything a Plugin can be created with, for what creates one inside the server: a duplicate
 * and the importers. `POST /api/plugins` takes `CreatePluginDto`. Nothing validates this: each
 * caller already builds it from trusted, typed data, and `PluginsService` checks what matters
 * (`assertKindFields`, `assertOneTemplatePerSize`, `fieldValues.assertWritable`) at run time.
 */
export interface WholePluginInput {
  name: string
  description?: string
  kind?: PluginKind
  refreshInterval?: number
  isActive?: boolean
  order?: number
  webhookToken?: string
  mergeStrategy?: MergeStrategy
  streamLimit?: number
  sourceRecipeId?: string
  sourceRecipeSnapshot?: RecipeSnapshot
  dataSources?: PluginDataSourceDto[]
  templates?: PluginTemplateInput[]
  fields?: PluginFieldDto[]
  // Keyed by Plugin Field keyname. A keyname left out keeps its stored value;
  // `null` or an empty string clears it.
  fieldValues?: Record<string, string | null>
}
