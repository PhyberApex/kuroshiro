<script setup lang="ts" generic="T extends string">
import type { SelectOption } from './selectOption'
import { SelectContent, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot, SelectTrigger } from 'reka-ui'
import { computed, useId } from 'vue'
import Icon from './Icon.vue'
import { OPTION_LIST_GAP, OPTION_LIST_LAYER } from './selectOption'
import SelectOptions from './SelectOptions.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
}>()

const model = defineModel<T | null>({ default: null })

const chosen = computed(() => props.options.find(option => option.value === model.value))

const reasonIdPrefix = useId()
const reasonId = (index: number) => `${reasonIdPrefix}-reason-${index}`
</script>

<template>
  <SelectRoot :model-value="model ?? undefined" :disabled="disabled" @update:model-value="model = $event as T">
    <SelectTrigger as-child>
      <button v-bind="$attrs" class="control trigger" :aria-invalid="invalid || undefined">
        <span :class="{ placeholder: !chosen }">{{ chosen?.label ?? placeholder }}</span>
        <Icon name="chevron" class="chevron" />
      </button>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        align="start"
        :side-offset="OPTION_LIST_GAP"
        :collision-padding="8"
        :style="OPTION_LIST_LAYER"
      >
        <SelectOptions>
          <SelectItem
            v-for="(option, index) in options"
            :key="option.value"
            class="option"
            :value="option.value"
            :text-value="option.label"
            :disabled="option.disabled"
            :aria-describedby="option.reason ? reasonId(index) : undefined"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <span v-if="option.reason" :id="reasonId(index)" class="reason">{{ option.reason }}</span>
            <SelectItemIndicator><Icon name="check" /></SelectItemIndicator>
          </SelectItem>
        </SelectOptions>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style scoped>
@layer components {
  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-width: 12rem;
    max-width: 100%;
    cursor: pointer;
    text-align: start;
  }

  .placeholder {
    color: var(--color-ink-soft);
  }

  .chevron {
    color: var(--color-ink-soft);
    transition: rotate var(--duration-quick) var(--ease-out);
  }

  .trigger[aria-expanded='true'] {
    border-color: var(--color-ink);
  }

  .trigger[aria-expanded='true'] .chevron {
    color: var(--color-ink);
    rotate: 180deg;
  }
}
</style>
