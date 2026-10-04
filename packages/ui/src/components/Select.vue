<script setup lang="ts" generic="T extends string">
import type { SelectOption } from './selectOption'
import { computed } from 'vue'
import SelectCombobox from './SelectCombobox.vue'
import SelectListbox from './SelectListbox.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  options: SelectOption<T>[]
  /** What the control reads while nothing is chosen. */
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  /** Makes it a combobox: an input that filters the list as the admin types. Left out, a list of more than eight options is one. */
  filter?: boolean
}>(), {
  filter: undefined,
})

const model = defineModel<T | null>({ default: null })

const LONG_LIST = 8
const filters = computed(() => props.filter ?? props.options.length > LONG_LIST)
</script>

<template>
  <component
    :is="filters ? SelectCombobox : SelectListbox"
    v-bind="$attrs"
    v-model="model"
    :options="options"
    :placeholder="placeholder"
    :disabled="disabled"
    :invalid="invalid"
  />
</template>
