import type { PluginDetail } from 'kuroshiro-shared'
import { maskedKey } from '@/pages/devices/deviceSettings'
import { MERGE_STRATEGY_CHOICES } from './addPlugin'

export type Webhook = NonNullable<PluginDetail['webhook']>

/** The Webhook URL ends in its Webhook Token, which is written as `shown` instead. */
const withTokenShownAs = ({ url, token }: Webhook, shown: string) => `${url.slice(0, url.length - token.length)}${shown}`

/** The Webhook URL as the row shows it: the token as dots and its last four characters until "Reveal". */
export const webhookAddress = (webhook: Webhook, revealed: boolean) => revealed ? webhook.url : withTokenShownAs(webhook, maskedKey(webhook.token))

function curlTo(address: string) {
  return [
    `curl -X POST ${address} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"message": "Hello from curl"}'`,
  ].join('\n')
}

/** The example call: `shown` has "…" for the token while it is hidden, `copied` is always the command that works. */
export function exampleCall(webhook: Webhook, revealed: boolean) {
  const copied = curlTo(webhook.url)
  return { shown: revealed ? copied : curlTo(withTokenShownAs(webhook, '…')), copied }
}

export function mergeStrategyRead({ mergeStrategy, streamLimit }: Webhook) {
  const choice = MERGE_STRATEGY_CHOICES.find(({ value }) => value === mergeStrategy)
  const streams = mergeStrategy === 'stream' && streamLimit !== null
  return {
    name: choice?.label ?? mergeStrategy,
    code: mergeStrategy,
    limit: streams ? `Stream Limit ${streamLimit}` : null,
    sentence: streams
      ? `Top-level arrays are appended to and keep their newest ${streamLimit} entries. Other keys are replaced.`
      : choice?.hint ?? '',
  }
}

export const payloadText = (payload: unknown) => JSON.stringify(payload, null, 2)

/** A key the template reads the stored Webhook Payload by. A list is the whole render context, so it has none. */
export function payloadExampleKey(payload: unknown): string | undefined {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? Object.keys(payload)[0] : undefined
}

export function clearPayloadWording(plugin: string) {
  return {
    title: `Clear ${plugin}'s Webhook Payload?`,
    lost: `The stored Webhook Payload. ${plugin} renders without data until the next POST.`,
    stays: 'The Webhook URL, the template and the Merge Strategy.',
  }
}

export function regenerateTokenWording(plugin: string) {
  return {
    title: `Regenerate ${plugin}'s Webhook Token?`,
    what: 'Everything that posts to the current Webhook URL is refused from now on, until you give it the new one.',
    lost: 'The current Webhook URL.',
    stays: 'The Webhook Payload, the template and the Merge Strategy.',
  }
}
