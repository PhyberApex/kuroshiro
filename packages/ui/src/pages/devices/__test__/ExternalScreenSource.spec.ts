import type { PropType } from 'vue'
import type { RadioChoice } from '@/components/RadioRow.vue'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { api, apiUrl } from '@/testing/api/server'
import { buildScreen } from '@/testing/fixtures/screens'
import { mount } from '@/testing/mount'
import { freezeTime } from '@/testing/time'
import ExternalScreenSource from '../ExternalScreenSource.vue'

/**
 * `RadioRow`'s `v-model` never hands back the value it already holds, so on the page a choice cannot be chosen
 * twice. This stand-in hands back whichever choice is pressed, to pin the guard behind it.
 */
const EveryPressRadioRow = defineComponent({
  props: { choices: { type: Array as PropType<RadioChoice<string>[]>, required: true } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => props.choices.map(choice => h('button', { type: 'button', onClick: () => emit('update:modelValue', choice.value) }, choice.label))
  },
})

describe('the fetching of an External link Screen', () => {
  it('sends nothing when the choice already chosen is chosen again', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    const webcam = buildScreen({ id: 'webcam', name: 'Harbour webcam', kind: 'external', plugin: null, external: { url: 'https://harbour.example/cam.jpg', fetchManual: true } })
    const writes: unknown[] = []
    api.use(http.patch(apiUrl('screens/webcam'), async ({ request }) => {
      writes.push(await request.json())
      return HttpResponse.json(webcam)
    }))
    const screen = await mount(ExternalScreenSource, {
      props: { screen: webcam, external: webcam.external!, reload: async () => {} },
      global: { stubs: { RadioRow: EveryPressRadioRow } },
    })

    await screen.getByRole('button', { name: 'Fetch once and keep' }).click()
    await screen.getByRole('button', { name: 'Fetch on every poll' }).click()

    await expect.poll(() => writes).toEqual([{ fetchManual: false }])
  })
})
