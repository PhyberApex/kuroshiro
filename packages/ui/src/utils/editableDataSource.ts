import type { PluginDataSource } from '@/types/plugin'

export type EditableDataSource = Partial<PluginDataSource> & { headersJson?: string, bodyJson?: string, literalValueJson?: string }

function toEditableJson(value: Record<string, unknown> | undefined): string {
  return value && Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : ''
}

export function toEditableDataSource(source: Partial<PluginDataSource>): EditableDataSource {
  return {
    ...source,
    headersJson: toEditableJson(source.headers),
    bodyJson: toEditableJson(source.body),
    literalValueJson: source.literalValue !== undefined ? JSON.stringify(source.literalValue, null, 2) : '',
  }
}

export function parseJsonOrKeep<T>(json: string | undefined, empty: T, current: T): T {
  if (!json || !json.trim())
    return empty
  try {
    return JSON.parse(json)
  }
  catch {
    return current
  }
}
