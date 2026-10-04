<script setup lang="ts">
import type { RadioChoice } from './RadioRow.vue'
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Checkbox from './Checkbox.vue'
import RadioRow from './RadioRow.vue'

type Kind = 'plugin' | 'mashup' | 'link' | 'file' | 'html'
type WhileAsleep = 'keep' | 'sleep-image'
type MergeStrategy = 'standard' | 'deep_merge'
type Fits = 'some' | 'all'

const kinds: RadioChoice<Kind>[] = [
  { value: 'plugin', label: 'Plugin', hint: 'One of your Plugins, rendered for this Device. Checked.' },
  { value: 'mashup', label: 'Mashup', hint: 'Several Plugins sharing one Screen in a layout. Default.' },
  { value: 'link', label: 'External link', hint: 'An image fetched from a URL. Hover.' },
  { value: 'file', label: 'File', hint: 'Not available in the demo. Disabled.', disabled: true },
  { value: 'html', label: 'HTML', hint: 'Markup you write here, with a live preview. Focus.' },
]
const mergeStrategies: RadioChoice<MergeStrategy>[] = [
  { value: 'standard', label: 'Replace', code: 'standard', hint: 'Each POST replaces the Webhook Payload.' },
  { value: 'deep_merge', label: 'Deep merge', code: 'deep_merge', hint: 'Objects are merged key by key. An array is replaced.' },
]
const whileAsleep: RadioChoice<WhileAsleep>[] = [
  { value: 'keep', label: 'Keep the last Screen' },
  { value: 'sleep-image', label: 'Show the sleep image' },
]

const fits: RadioChoice<Fits>[] = [
  { value: 'some', label: 'Only these Device Models', hint: 'It is offered to Devices of these Device Models only.' },
  { value: 'all', label: 'Every Device Model', hint: 'Nothing stops it from being pushed to a Device it was not built for.' },
]

const kind = ref<Kind>('plugin')
const fit = ref<Fits>('some')
const asleep = ref<WhileAsleep>('keep')
const mergeStrategy = ref<MergeStrategy>('standard')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="checked, default, hover, disabled, focus" wide>
      <RadioRow v-model="kind" class="rows" :choices="kinds" aria-label="Kind" :force="{ link: 'hover', html: 'focus' }" />
    </Specimen>
  </SpecimenRow>

  <SpecimenRow>
    <Specimen caption="with the value's code beside the name" wide>
      <RadioRow v-model="mergeStrategy" class="rows" :choices="mergeStrategies" aria-label="Merge Strategy" />
    </Specimen>
  </SpecimenRow>

  <SpecimenRow>
    <Specimen caption="without explanations" wide>
      <RadioRow v-model="asleep" class="rows" :choices="whileAsleep" aria-label="While asleep" />
    </Specimen>
    <Specimen caption="disabled" wide>
      <RadioRow v-model="asleep" class="rows" :choices="whileAsleep" aria-label="While asleep" disabled />
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="With what a choice holds under it">
    <Specimen caption="between its row and the next" wide>
      <RadioRow v-model="fit" class="rows" :choices="fits" aria-label="Fits">
        <template #under="{ choice }">
          <div v-if="choice.value === 'some' && fit === 'some'" class="held">
            <Checkbox :model-value="true">
              TRMNL OG
            </Checkbox>
            <Checkbox>TRMNL X</Checkbox>
          </div>
        </template>
      </RadioRow>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .rows {
    width: 100%;
  }

  .held {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-6);
    padding-left: calc(var(--icon) + var(--space-3));
    border-bottom: var(--rule);
  }
}
</style>
