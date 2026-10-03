<script setup lang="ts">
import TextInput from './TextInput.vue'

defineProps<{
  disabled?: boolean
  invalid?: boolean
}>()

const emit = defineEmits<{
  /** On blur and on Enter, not as each part of the time is filled in. */
  commit: [value: string | null]
}>()

/** A time of day as the API takes it, `HH:MM` on the 24-hour clock, whatever the browser's locale shows. `null` while the input is empty or half filled. */
const model = defineModel<string | null>({ default: null })

function fromNative(text: string) {
  return text.slice(0, 'HH:MM'.length) || null
}
</script>

<template>
  <TextInput
    type="time"
    :model-value="model ?? ''"
    :disabled="disabled"
    :invalid="invalid"
    @update:model-value="model = fromNative($event)"
    @commit="emit('commit', fromNative($event))"
  >
    <template #status>
      <slot name="status" />
    </template>
  </TextInput>
</template>
