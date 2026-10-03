<script setup lang="ts">
import { ref, watch } from 'vue'
import { commitWhenDone } from './commitWhenDone'
import TextInput from './TextInput.vue'

defineProps<{
  disabled?: boolean
  invalid?: boolean
  wide?: boolean
}>()

const emit = defineEmits<{
  /** On blur and on Enter, with the number, or `null` for an input that holds none. */
  commit: [value: number | null]
}>()

/** A number, as the API takes it. `null` while the input is empty or holds no number. */
const model = defineModel<number | null>({ default: null })

function toNumber(text: string) {
  return text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text)
}

function toText(value: number | null) {
  return value === null ? '' : String(value)
}

// What is typed is kept beside the number, so "1." or "0.50" is not rewritten under the caret.
const typed = ref(toText(model.value))

watch(model, (value) => {
  if (toNumber(typed.value) !== value)
    typed.value = toText(value)
})

// "60" retyped as "60.0" is a changed text and the same number, so the number is what is compared.
const { hold, commit } = commitWhenDone(model, value => emit('commit', value))

function onTyped(text: string) {
  typed.value = text
  model.value = toNumber(text)
}
</script>

<template>
  <TextInput
    type="number"
    :model-value="typed"
    :disabled="disabled"
    :invalid="invalid"
    :wide="wide"
    @update:model-value="onTyped"
    @focus="hold"
    @commit="commit"
  >
    <template #status>
      <slot name="status" />
    </template>
  </TextInput>
</template>
