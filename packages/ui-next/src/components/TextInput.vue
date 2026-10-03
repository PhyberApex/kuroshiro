<script setup lang="ts">
import { commitWhenDone } from './commitWhenDone'

defineOptions({ inheritAttrs: false })

defineProps<{
  disabled?: boolean
  /** Draws the doubled ink border and sets `aria-invalid`. The message is the Field's. */
  invalid?: boolean
  /** Sets the value in the text face instead of mono: a name, not an identifier. */
  prose?: boolean
  /** Fills the line it sits on. */
  wide?: boolean
}>()

const emit = defineEmits<{
  /** The admin is done with the value: on blur and on Enter, and only when it differs from the last one committed. Save as changed listens to this. */
  commit: [value: string]
}>()

defineSlots<{
  /** The place of the save state ("Saving", "Saved"), beside the input. */
  status?: () => unknown
}>()

const model = defineModel<string>({ default: '' })

const { hold, commit } = commitWhenDone(model, value => emit('commit', value))
</script>

<template>
  <span class="line" :class="{ wide }">
    <input
      v-bind="$attrs"
      class="control"
      :class="{ prose }"
      :value="model"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      @input="model = ($event.target as HTMLInputElement).value"
      @focus="hold"
      @blur="commit"
      @keydown.enter="commit"
    >
    <slot name="status" />
  </span>
</template>

<style scoped>
@layer components {
  .line {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    max-width: 100%;
  }

  .wide {
    display: flex;
    width: 100%;
  }

  .wide .control {
    flex: 1;
  }
}
</style>
