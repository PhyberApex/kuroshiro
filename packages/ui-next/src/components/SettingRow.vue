<script setup lang="ts">
import type { SaveStatus } from './useSaveAsChanged'
import { computed, useId } from 'vue'
import FieldError from './FieldError.vue'
import SaveState from './SaveState.vue'

const props = withDefaults(defineProps<{
  label: string
  /** Where the setting's save stands, as `useSaveAsChanged` reports it. */
  status?: SaveStatus
  /** Why the save failed, as a sentence. */
  reason?: string
  /** What is wrong with the value and what is allowed. Set, it marks the control invalid and stands above the note. */
  error?: string
}>(), {
  status: 'idle',
})

defineEmits<{
  /** "Try again" was pressed. */
  retry: []
}>()

const slots = defineSlots<{
  /**
   * The control. One control takes `v-bind="control"`: the id the label points at, what describes it and the invalid flag.
   * A group of controls (a radio row, a weekday toggle) is named with `:aria-labelledby="labelId"` instead.
   */
  default: (props: {
    control: { 'id': string, 'aria-describedby': string | undefined, 'invalid': boolean }
    labelId: string
  }) => unknown
  /** What the setting does, under the control. */
  note?: () => unknown
  /** Where the value comes from, at the row's side: "Built-in default", or "Set here" with the button that resets it. "Saving" and "Saved" take its place while they show. */
  source?: () => unknown
}>()

const id = useId()
const controlId = `${id}-control`
const labelId = `${id}-label`
const noteId = `${id}-note`
const errorId = `${id}-error`

const control = computed(() => ({
  'id': controlId,
  'aria-describedby': [props.error && errorId, slots.note && noteId].filter(Boolean).join(' ') || undefined,
  'invalid': Boolean(props.error),
}))

const saveStateTakesTheSide = computed(() => props.status === 'saving' || props.status === 'saved')
</script>

<template>
  <div class="setting-row">
    <label :id="labelId" class="label" :for="controlId">{{ label }}</label>
    <div class="control-cell">
      <slot :control="control" :label-id="labelId" />
    </div>
    <SaveState class="state" :status="status" :reason="reason" @retry="$emit('retry')" />
    <p v-if="$slots.source && !saveStateTakesTheSide" class="source">
      <slot name="source" />
    </p>
    <FieldError :id="errorId" class="under" :message="error" />
    <p v-if="$slots.note" :id="noteId" class="note">
      <slot name="note" />
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .setting-row {
    display: grid;
    grid-template-columns: var(--setting-label-width, 12.5rem) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-1) var(--space-4);
    min-height: 3.25rem;
    padding: var(--space-2) 0;
  }

  .setting-row + .setting-row {
    border-top: var(--rule);
  }

  .label {
    font-weight: var(--weight-medium);
  }

  .control-cell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    min-width: 0;
  }

  .state,
  .source {
    grid-row: 1;
    grid-column: 3;
  }

  .source {
    max-width: 17rem;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-align: right;
    overflow-wrap: anywhere;
  }

  /* "Saving" and "Saved" stand at the row's side. A failed save has a reason and a button, so it goes under the control, where an error goes. */
  .note,
  .under,
  .state.failed {
    grid-row: auto;
    grid-column: 2 / -1;
  }

  .note {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  @media (max-width: 820px) {
    .setting-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .state,
    .source,
    .note,
    .under,
    .state.failed {
      grid-row: auto;
      grid-column: 1;
    }

    .source {
      max-width: none;
      text-align: left;
    }
  }
}
</style>
