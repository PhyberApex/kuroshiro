import type { DataSourceMode } from './entities/plugin-data-source.entity'

export interface DataSourceModeFields {
  mode?: DataSourceMode
  method?: unknown
  url?: unknown
  headers?: unknown
  body?: unknown
  transformJs?: unknown
  literalValue?: unknown
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null
}

/**
 * fetch and literal Data Sources have disjoint required fields; a Data
 * Source carrying a field from the mode it isn't is rejected rather than
 * silently ignored — structurally parallel to pluginKindFieldViolation.
 */
export function dataSourceModeViolation(fields: DataSourceModeFields): string | null {
  const { mode = 'fetch', method, url, headers, body, transformJs, literalValue } = fields

  if (mode === 'literal') {
    // PluginDataSource.method is a non-nullable column defaulting to 'GET'
    // (shared with fetch mode, which needs a real default there) — a
    // literal-mode row loaded back from storage always carries 'GET' even
    // though nothing ever asked for it, so only a caller-supplied
    // *non*-default method counts as a real fetch-field violation here.
    if (isPresent(method) && method !== 'GET') {
      return 'A literal-mode Data Source cannot have a Method'
    }
    if (isPresent(url)) {
      return 'A literal-mode Data Source cannot have a URL'
    }
    if (isPresent(headers)) {
      return 'A literal-mode Data Source cannot have Headers'
    }
    if (isPresent(body)) {
      return 'A literal-mode Data Source cannot have a Body'
    }
    if (isPresent(transformJs)) {
      return 'A literal-mode Data Source cannot have a Transform'
    }
    if (!isPresent(literalValue)) {
      return 'A literal-mode Data Source requires a Value'
    }
    return null
  }

  if (isPresent(literalValue)) {
    return 'A fetch-mode Data Source cannot have a Value'
  }
  if (!isPresent(url)) {
    return 'A fetch-mode Data Source requires a URL'
  }

  return null
}
