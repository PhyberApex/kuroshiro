<script setup lang="ts">
import type { PluginFieldOption } from 'kuroshiro-shared'
import { listValuesOf } from 'kuroshiro-shared'
import { computed } from 'vue'
import Checkbox from '@/components/Checkbox.vue'

/** The control of a select that allows several (ADR-0064): a checkbox per option, the ticked ones kept one per line in the options' order. */
const props = defineProps<{
  options: PluginFieldOption[]
  /** The Plugin Field's default, ticked while nothing is entered. */
  defaultValue?: string
  label: string
  invalid: boolean
}>()

const entered = defineModel<string>({ required: true })

const ticked = computed(() => listValuesOf(entered.value || props.defaultValue || ''))

function tick(value: string, on: boolean) {
  const kept = props.options.map(option => option.value).filter(candidate => candidate === value ? on : ticked.value.includes(candidate))
  entered.value = kept.join('\n')
}
</script>

<template>
  <fieldset class="checklist" :aria-label="label" :aria-invalid="invalid || undefined">
    <Checkbox v-for="option in options" :key="option.value" :model-value="ticked.includes(option.value)" @update:model-value="tick(option.value, $event)">
      {{ option.label }}
    </Checkbox>
  </fieldset>
</template>

<style scoped>
@layer components {
  .checklist {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    margin: 0;
    padding: 0;
    border: 0;
  }
}
</style>
