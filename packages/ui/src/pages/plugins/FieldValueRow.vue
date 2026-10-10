<script setup lang="ts">
import type { PluginFieldInput } from 'kuroshiro-shared'
import { computed } from 'vue'
import Button from '@/components/Button.vue'
import Icon from '@/components/Icon.vue'
import FieldValueControl from './FieldValueControl.vue'
import { fieldControl, fieldValueNote, isClearable } from './pluginFieldValues'
import { fieldId } from './pluginPage'

/** One Plugin Field as a row of the Field Values: its label, the control of its type, the note at the right and its help text. */
const props = defineProps<{
  field: PluginFieldInput
  /** Whether the server holds a password for it that a save without a new one keeps. */
  secretStored: boolean
}>()

const entered = defineModel<string>({ required: true })

const id = computed(() => fieldId(`fieldValues.${props.field.keyname}`))
const label = computed(() => props.field.name || props.field.keyname)
const note = computed(() => fieldValueNote(props.field, { entered: entered.value, secretStored: props.secretStored }))
const empty = computed(() => note.value === 'Empty')
const clearable = computed(() => isClearable(props.field.fieldType, entered.value))

const describedBy = computed(() => [
  props.field.required && `${id.value}-required`,
  note.value && !clearable.value && `${id.value}-note`,
  props.field.description && `${id.value}-help`,
].filter(Boolean).join(' ') || undefined)

function clear() {
  entered.value = ''
}
</script>

<template>
  <div class="field-value-row">
    <div class="naming">
      <label class="label" :for="id">{{ label }}</label>
      <span v-if="field.required" :id="`${id}-required`" class="required">required</span>
    </div>
    <div class="control-cell" :class="fieldControl(field.fieldType)">
      <FieldValueControl
        :id="id"
        v-model="entered"
        :field="field"
        :label="label"
        :secret-stored="secretStored"
        :invalid="empty"
        :aria-describedby="describedBy"
      />
    </div>
    <p v-if="clearable" class="note">
      <Button variant="quiet" @click="clear">
        Clear {{ label }}
      </Button>
    </p>
    <p v-else-if="note" :id="`${id}-note`" class="note" :class="{ empty }">
      <Icon v-if="empty" name="problem" />
      {{ note }}
    </p>
    <p v-if="field.description" :id="`${id}-help`" class="help">
      {{ field.description }}
    </p>
  </div>
</template>

<style scoped>
@layer components {
  /* The grid of a Setting row, drawn here because that row's label has no place for "required" under it. */
  .field-value-row {
    display: grid;
    grid-template-columns: var(--setting-label-width, 12.5rem) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-1) var(--space-4);
    min-height: 3.25rem;
    padding: var(--space-2) 0;
  }

  .field-value-row + .field-value-row {
    border-top: var(--rule);
  }

  .naming {
    display: grid;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .label {
    font-weight: var(--weight-medium);
  }

  .required {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .control-cell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    min-width: 0;
  }

  /* A value is entered in a control of the width its type calls for, not of the row's. */
  .control-cell:is(.text, .textarea, .secret) {
    max-width: 22rem;
  }

  .control-cell.number {
    max-width: 7rem;
  }

  .note {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 17rem;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-align: right;
  }

  .note.empty {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .help {
    grid-column: 2 / -1;
    max-width: var(--measure);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  @media (max-width: 820px) {
    .field-value-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .naming {
      grid-auto-flow: column;
      justify-content: start;
      align-items: baseline;
      gap: var(--space-2);
    }

    .note {
      max-width: none;
      text-align: left;
    }

    .help {
      grid-column: 1;
    }
  }
}
</style>
