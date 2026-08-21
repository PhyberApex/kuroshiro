import type { MergeStrategy, PluginKind } from './entities/plugin.entity'

export interface PluginKindFields {
  kind: PluginKind
  dataSource?: unknown
  webhookToken?: unknown
  mergeStrategy?: MergeStrategy | null
  streamLimit?: number | null
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null
}

/**
 * Poll and Webhook Plugins have disjoint required fields; a Plugin carrying a
 * field from the Kind it isn't is rejected rather than silently ignored.
 */
export function pluginKindFieldViolation(fields: PluginKindFields): string | null {
  const { kind, dataSource, webhookToken, mergeStrategy, streamLimit } = fields

  if (isPresent(webhookToken)) {
    return 'The Webhook Token is issued by Kuroshiro and cannot be set directly'
  }

  if (kind === 'Poll') {
    if (isPresent(mergeStrategy)) {
      return 'A Poll-kind Plugin cannot have a Merge Strategy'
    }
    if (isPresent(streamLimit)) {
      return 'A Poll-kind Plugin cannot have a Stream Limit'
    }
    return null
  }

  if (isPresent(dataSource)) {
    return 'A Webhook-kind Plugin cannot have a Data Source'
  }
  if (!isPresent(mergeStrategy)) {
    return 'A Webhook-kind Plugin requires a Merge Strategy'
  }
  if (mergeStrategy === 'stream' && !isPresent(streamLimit)) {
    return 'A stream Merge Strategy requires a Stream Limit'
  }
  if (mergeStrategy !== 'stream' && isPresent(streamLimit)) {
    return 'A Stream Limit is only valid for the stream Merge Strategy'
  }

  return null
}
