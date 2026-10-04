import type { Webhook } from '../pluginWebhook'
import { describe, expect, it } from 'vitest'
import { clearPayloadWording, exampleCall, mergeStrategyRead, payloadExampleKey, payloadText, regenerateTokenWording, webhookAddress } from '../pluginWebhook'

const TOKEN = 'wh8c1f02d94a7be6033f9a'
const URL = `https://kuroshiro.example/api/webhook/${TOKEN}`

function webhook(overrides: Partial<Webhook> = {}): Webhook {
  return { token: TOKEN, url: URL, mergeStrategy: 'standard', streamLimit: null, payload: null, payloadReceivedAt: null, ...overrides }
}

describe('the Webhook section of the Plugin page', () => {
  it('shows the Webhook URL with the token as dots and its last four characters until it is revealed', () => {
    expect(webhookAddress(webhook(), false)).toBe(`https://kuroshiro.example/api/webhook/${'•'.repeat(TOKEN.length - 4)}3f9a`)
    expect(webhookAddress(webhook(), true)).toBe(URL)
  })

  it('writes the token into the example call only while it is revealed, and copies the working command either way', () => {
    const hidden = exampleCall(webhook(), false)
    const revealed = exampleCall(webhook(), true)

    expect(hidden.shown).toContain('https://kuroshiro.example/api/webhook/… \\')
    expect(hidden.shown).not.toContain(TOKEN)
    expect(revealed.shown).toContain(`${URL} \\`)
    expect(hidden.copied).toBe(revealed.shown)
    expect(revealed.copied).toBe(revealed.shown)
    expect(revealed.shown).toMatch(/^curl -X POST /)
    expect(revealed.shown).toContain('-H "Content-Type: application/json"')
  })

  it('names the Merge Strategy as Add a Plugin does, with its API value and its sentence', () => {
    expect(mergeStrategyRead(webhook())).toEqual({ name: 'Replace', code: 'standard', limit: null, sentence: 'Each POST replaces the Webhook Payload.' })
    expect(mergeStrategyRead(webhook({ mergeStrategy: 'deep_merge' }))).toEqual({ name: 'Deep merge', code: 'deep_merge', limit: null, sentence: 'Objects are merged key by key. An array is replaced.' })
  })

  it('adds the Stream Limit to a Stream and words its sentence with it', () => {
    expect(mergeStrategyRead(webhook({ mergeStrategy: 'stream', streamLimit: 20 }))).toEqual({
      name: 'Stream',
      code: 'stream',
      limit: 'Stream Limit 20',
      sentence: 'Top-level arrays are appended to and keep their newest 20 entries. Other keys are replaced.',
    })
  })

  it('shows a stored Webhook Payload as indented JSON', () => {
    expect(payloadText({ title: 'Back at six.', readings: [1, 2] })).toBe('{\n  "title": "Back at six.",\n  "readings": [\n    1,\n    2\n  ]\n}')
  })

  it('takes the first key of an object as the example the template reads, and none of a list or an empty object', () => {
    expect(payloadExampleKey({ title: 'Back at six.', body: 'Soup' })).toBe('title')
    expect(payloadExampleKey([{ title: 'Back at six.' }])).toBeUndefined()
    expect(payloadExampleKey({})).toBeUndefined()
  })

  it('words both confirmations with the Plugin\'s name', () => {
    expect(clearPayloadWording('Doorbell note')).toEqual({
      title: 'Clear Doorbell note\'s Webhook Payload?',
      lost: 'The stored Webhook Payload. Doorbell note renders without data until the next POST.',
      stays: 'The Webhook URL, the template and the Merge Strategy.',
    })
    expect(regenerateTokenWording('Doorbell note')).toEqual({
      title: 'Regenerate Doorbell note\'s Webhook Token?',
      what: 'Everything that posts to the current Webhook URL is refused from now on, until you give it the new one.',
      lost: 'The current Webhook URL.',
      stays: 'The Webhook Payload, the template and the Merge Strategy.',
    })
  })
})
