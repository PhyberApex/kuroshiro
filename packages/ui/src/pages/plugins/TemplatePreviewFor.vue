<script setup lang="ts">
import type { TemplateSize } from 'kuroshiro-shared'
import type { PreviewChoice, PreviewLibrary, PreviewTarget } from './previewTarget'
import { computed, useId } from 'vue'
import Select from '@/components/Select.vue'
import { honestLine, targetFacts } from './pluginTemplateWording'
import { palettesOf } from './previewTarget'

/** What sits under the plate: which Device or Device Model the preview is for, its facts, and what the plate is not. */
const props = defineProps<{
  library: PreviewLibrary
  target: PreviewTarget
  /** The size of the Template that is drawn. */
  size: TemplateSize
}>()

const choice = defineModel<PreviewChoice>('choice', { required: true })

/** The option of the first select that is no Device. A Device's id never reads like it. */
const ANOTHER_MODEL = 'another-device-model'

const labelId = useId()

const deviceOptions = computed(() => [
  ...props.library.devices.map(device => ({ value: device.id, label: device.name })),
  { value: ANOTHER_MODEL, label: 'Another Device Model' },
])

const modelOptions = computed(() => props.library.models.map(model => ({ value: model.name, label: model.label })))
const paletteOptions = computed(() => palettesOf(props.target.model, props.library.palettes).map(palette => ({ value: palette.id, label: palette.name })))

const chosenDevice = computed({
  get: () => props.target.device?.id ?? ANOTHER_MODEL,
  set: (value) => {
    choice.value = value === ANOTHER_MODEL
      ? { deviceId: null, modelName: props.target.model.name, paletteId: props.target.palette.id }
      : { deviceId: value, modelName: null, paletteId: null }
  },
})

const chosenModel = computed({
  get: () => props.target.model.name,
  set: modelName => (choice.value = { deviceId: null, modelName, paletteId: null }),
})

const chosenPalette = computed({
  get: () => props.target.palette.id,
  set: paletteId => (choice.value = { deviceId: null, modelName: props.target.model.name, paletteId }),
})
</script>

<template>
  <div class="preview-for">
    <div class="choice">
      <span :id="labelId" class="label">Preview for</span>
      <Select v-if="library.devices.length > 0" v-model="chosenDevice" class="prose" :options="deviceOptions" :aria-labelledby="labelId" />
      <template v-if="!target.device">
        <Select v-model="chosenModel" class="prose" :options="modelOptions" aria-label="Device Model" />
        <Select v-model="chosenPalette" class="prose" :options="paletteOptions" aria-label="Palette" />
      </template>
    </div>
    <p class="facts">
      {{ targetFacts(target) }}
    </p>
    <p class="honest">
      {{ honestLine(target, size) }}
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .choice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .facts,
  .honest {
    margin-top: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  .facts {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
}
</style>
