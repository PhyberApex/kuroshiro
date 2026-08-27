import type { DataSourceMode } from 'kuroshiro-shared'

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

type ModeViolation = [fieldName: string, isViolation: boolean, message: string]

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
    const literalModeViolations: ModeViolation[] = [
      ['url', isPresent(url), 'A literal-mode Data Source cannot have a URL'],
      ['headers', isPresent(headers), 'A literal-mode Data Source cannot have Headers'],
      ['body', isPresent(body), 'A literal-mode Data Source cannot have a Body'],
      ['transformJs', isPresent(transformJs), 'A literal-mode Data Source cannot have a Transform'],
      ['literalValue', !isPresent(literalValue), 'A literal-mode Data Source requires a Value'],
    ]
    return literalModeViolations.find(([, isViolation]) => isViolation)?.[2] ?? null
  }

  const fetchModeViolations: ModeViolation[] = [
    ['literalValue', isPresent(literalValue), 'A fetch-mode Data Source cannot have a Value'],
    ['url', !isPresent(url), 'A fetch-mode Data Source requires a URL'],
  ]
  return fetchModeViolations.find(([, isViolation]) => isViolation)?.[2] ?? null
}
