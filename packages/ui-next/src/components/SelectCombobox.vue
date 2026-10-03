<script setup lang="ts" generic="T extends string">
import type { SelectOption } from './selectOption'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
} from 'reka-ui'
import { useId } from 'vue'
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

// An option is named by its label alone and described by its reason, as in the plain list.
const idPrefix = useId()
const labelId = (index: number) => `${idPrefix}-label-${index}`
const reasonId = (index: number) => `${idPrefix}-reason-${index}`

function labelOf(value: T | null | undefined) {
  return props.options.find(option => option.value === value)?.label ?? ''
}
</script>

<template>
  <ComboboxRoot
    :model-value="model ?? undefined"
    :disabled="disabled"
    open-on-click
    class="combobox"
    @update:model-value="model = $event as T"
  >
    <ComboboxAnchor class="anchor">
      <ComboboxInput
        v-bind="$attrs"
        class="control input"
        :display-value="labelOf"
        :placeholder="placeholder"
        :aria-invalid="invalid || undefined"
      />
      <ComboboxTrigger class="opener" aria-label="Show the list">
        <Icon name="chevron" />
      </ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        align="start"
        :side-offset="OPTION_LIST_GAP"
        :collision-padding="8"
        :body-lock="false"
        :style="OPTION_LIST_LAYER"
      >
        <SelectOptions>
          <ComboboxEmpty class="nothing">
            Nothing matches
          </ComboboxEmpty>
          <ComboboxItem
            v-for="(option, index) in options"
            :key="option.value"
            class="option"
            :value="option.value"
            :text-value="option.label"
            :disabled="option.disabled"
            :aria-disabled="option.disabled || undefined"
            :aria-labelledby="labelId(index)"
            :aria-describedby="option.reason ? reasonId(index) : undefined"
          >
            <span :id="labelId(index)">{{ option.label }}</span>
            <span v-if="option.reason" :id="reasonId(index)" class="reason">{{ option.reason }}</span>
            <ComboboxItemIndicator><Icon name="check" /></ComboboxItemIndicator>
          </ComboboxItem>
        </SelectOptions>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>

<style scoped>
@layer components {
  .combobox {
    display: inline-block;
    min-width: 12rem;
    max-width: 100%;
  }

  .anchor {
    position: relative;
    display: block;
  }

  .input {
    width: 100%;
    padding-right: calc(var(--space-2) * 2 + var(--icon));
    text-overflow: ellipsis;
  }

  .input[aria-expanded='true'] {
    border-color: var(--color-ink);
  }

  .opener {
    position: absolute;
    top: 0;
    right: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--space-2) * 2 + var(--icon));
    height: 100%;
    color: var(--color-ink-soft);
    transition: rotate var(--duration-quick) var(--ease-out);
  }

  .opener[aria-expanded='true'] {
    color: var(--color-ink);
    rotate: 180deg;
  }

  .opener:disabled {
    cursor: default;
  }
}
</style>
