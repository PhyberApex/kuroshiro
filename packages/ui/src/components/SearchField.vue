<script setup lang="ts">
import Icon from './Icon.vue'

defineOptions({ inheritAttrs: false })

defineProps<{
  disabled?: boolean
  invalid?: boolean
}>()

/** What is searched for, reported as it is typed. The field has no visible label: give it an `aria-label`. */
const model = defineModel<string>({ default: '' })
</script>

<template>
  <span class="search-field">
    <Icon name="search" class="glass" />
    <input
      v-bind="$attrs"
      type="search"
      class="control prose input"
      :value="model"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      @input="model = ($event.target as HTMLInputElement).value"
    >
  </span>
</template>

<style scoped>
@layer components {
  .search-field {
    position: relative;
    display: block;
  }

  .glass {
    position: absolute;
    top: 50%;
    left: var(--space-2);
    color: var(--color-ink-soft);
    pointer-events: none;
    translate: 0 -50%;
  }

  .input {
    width: 100%;
    padding-left: calc(var(--space-2) * 2 + var(--icon));
  }
}
</style>
