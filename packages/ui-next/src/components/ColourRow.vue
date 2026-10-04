<script setup lang="ts">
import { HEX_COLOR_PATTERN } from 'kuroshiro-shared'
import { computed } from 'vue'
import IconButton from './IconButton.vue'
import TextInput from './TextInput.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** The input's accessible name: "Colour 2". The remove button is called "Remove colour 2". */
  label: string
  /** Draws the doubled ink border and sets `aria-invalid`. The message is the caller's. */
  invalid?: boolean
}>()

defineEmits<{
  remove: []
}>()

const model = defineModel<string>({ default: '' })

const shown = computed(() => HEX_COLOR_PATTERN.test(model.value.trim()) ? model.value.trim() : undefined)
const removeLabel = computed(() => `Remove ${props.label.charAt(0).toLowerCase()}${props.label.slice(1)}`)
</script>

<template>
  <span class="colour-row">
    <i class="colour-swatch" :class="{ unknown: !shown }" :style="{ backgroundColor: shown }" aria-hidden="true" />
    <TextInput
      v-model="model"
      v-bind="$attrs"
      class="hex"
      :aria-label="label"
      :invalid="invalid"
      autocomplete="off"
      spellcheck="false"
    />
    <IconButton icon="close" :label="removeLabel" @click="$emit('remove')" />
  </span>
</template>

<style scoped>
@layer components {
  .colour-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  /* The colour is the data: the one place outside a Screen's image where the UI paints a colour that is not ink, paper or the seal. */
  .colour-swatch {
    box-sizing: border-box;
    flex: none;
    width: var(--control-height);
    height: var(--control-height);
    border: var(--rule-control);
    border-radius: var(--radius);
  }

  .colour-swatch.unknown {
    border-style: dashed;
  }

  .colour-row :deep(.hex) {
    width: 7.5rem;
  }
}
</style>
