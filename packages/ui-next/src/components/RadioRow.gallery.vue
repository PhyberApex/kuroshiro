<script setup lang="ts">
import type { RadioChoice } from './RadioRow.vue'
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import RadioRow from './RadioRow.vue'

type Kind = 'plugin' | 'mashup' | 'link' | 'file' | 'html'
type WhileAsleep = 'keep' | 'sleep-image'

const kinds: RadioChoice<Kind>[] = [
  { value: 'plugin', label: 'Plugin', hint: 'One of your Plugins, rendered for this Device. Checked.' },
  { value: 'mashup', label: 'Mashup', hint: 'Several Plugins sharing one Screen in a layout. Default.' },
  { value: 'link', label: 'External link', hint: 'An image fetched from a URL. Hover.' },
  { value: 'file', label: 'File', hint: 'Not available in the demo. Disabled.', disabled: true },
  { value: 'html', label: 'HTML', hint: 'Markup you write here, with a live preview. Focus.' },
]
const whileAsleep: RadioChoice<WhileAsleep>[] = [
  { value: 'keep', label: 'Keep the last Screen' },
  { value: 'sleep-image', label: 'Show the sleep image' },
]

const kind = ref<Kind>('plugin')
const asleep = ref<WhileAsleep>('keep')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="checked, default, hover, disabled, focus" wide>
      <RadioRow v-model="kind" class="rows" :choices="kinds" aria-label="Kind" :force="{ link: 'hover', html: 'focus' }" />
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
</template>

<style scoped>
@layer components {
  .rows {
    width: 100%;
  }
}
</style>
