<script setup lang="ts" generic="T extends string">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { useId } from 'vue'

export interface RadioChoice<T extends string> {
  value: T
  label: string
  /** One line of explanation under the name. */
  hint?: string
  disabled?: boolean
}

defineProps<{
  choices: RadioChoice<T>[]
  disabled?: boolean
  /** For the gallery: the states held still on a choice, by its value, such as `{ mashup: 'hover' }`. */
  force?: Partial<Record<T, string>>
}>()

const model = defineModel<T>()

const id = useId()
</script>

<template>
  <RadioGroupRoot
    class="rows"
    :model-value="model"
    :disabled="disabled"
    @update:model-value="model = $event as T"
  >
    <RadioGroupItem
      v-for="(choice, index) in choices"
      :key="choice.value"
      class="row"
      :value="choice.value"
      :disabled="choice.disabled"
      :aria-labelledby="`${id}-${index}-name`"
      :aria-describedby="choice.hint ? `${id}-${index}-hint` : undefined"
      :data-force="force?.[choice.value]"
    >
      <span class="dot" />
      <span :id="`${id}-${index}-name`" class="name">{{ choice.label }}</span>
      <span v-if="choice.hint" :id="`${id}-${index}-hint`" class="hint">{{ choice.hint }}</span>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<style scoped>
@layer components {
  .rows {
    display: grid;
  }

  .row {
    display: grid;
    grid-template-columns: var(--icon) minmax(0, 1fr);
    gap: 2px var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
    border-radius: 0;
  }

  .dot {
    display: grid;
    place-items: center;
    grid-row: 1 / 3;
    width: var(--icon);
    height: var(--icon);
    margin-top: 2px;
    border: var(--rule-control);
    border-radius: 50%;
    transition: border-color var(--duration-quick) var(--ease-out);
  }

  .row[aria-checked='true'] .dot {
    border-color: var(--color-ink);
  }

  .row[aria-checked='true'] .dot::after {
    content: "";
    width: var(--space-2);
    height: var(--space-2);
    border-radius: 50%;
    background: var(--color-ink);
  }

  .name {
    grid-column: 2;
    font-weight: var(--weight-semibold);
  }

  .hint {
    grid-column: 2;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the row. */
  .row:not(:disabled):is(:hover, [data-force~='hover']) .name {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .row:not(:disabled):is(:hover, [data-force~='hover']) .dot {
    border-color: var(--color-ink);
  }

  .row:disabled {
    cursor: default;
  }

  .row:disabled .name {
    color: var(--color-ink-soft);
    font-weight: var(--weight-medium);
  }

  .row:disabled .dot {
    border-color: var(--color-line);
  }

  .row[aria-checked='true']:disabled .dot::after {
    background: var(--color-ink-soft);
  }
}
</style>
