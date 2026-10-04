<script setup lang="ts">
import { Label } from 'reka-ui'
import { computed, useId } from 'vue'
import FieldError from './FieldError.vue'

const props = defineProps<{
  label: string
  /** The control may be left empty: the label says so. */
  optional?: boolean
  /** The explanation under the control. An error takes its place. */
  hint?: string
  /** What is wrong and what is allowed. Set, it marks the control invalid, describes it and is announced. */
  error?: string
  /** The control's id. Left out, one is made up. */
  id?: string
}>()

defineSlots<{
  /** Holds one control, which takes `v-bind="control"`: the id the label points at, the description and the invalid flag. */
  default: (props: { control: { 'id': string, 'aria-describedby': string | undefined, 'invalid': boolean } }) => unknown
}>()

const generatedId = useId()
const controlId = computed(() => props.id ?? generatedId)
const hintId = computed(() => `${controlId.value}-hint`)
const errorId = computed(() => `${controlId.value}-error`)

function describedBy() {
  if (props.error)
    return errorId.value
  return props.hint ? hintId.value : undefined
}

const control = computed(() => ({
  'id': controlId.value,
  'aria-describedby': describedBy(),
  'invalid': Boolean(props.error),
}))
</script>

<template>
  <div class="field">
    <Label class="label" :for="controlId">
      {{ label }}
      <span v-if="optional" class="optional">optional</span>
    </Label>
    <slot :control="control" />
    <p v-if="hint && !error" :id="hintId" class="hint">
      {{ hint }}
    </p>
    <FieldError :id="errorId" :message="error" />
  </div>
</template>

<style scoped>
@layer components {
  .field {
    display: grid;
    justify-items: start;
    max-width: 22rem;
  }

  .label {
    padding-bottom: var(--space-1);
    font-weight: var(--weight-medium);
  }

  .optional {
    color: var(--color-ink-soft);
    font-weight: var(--weight-regular);
  }

  .hint {
    padding-top: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
