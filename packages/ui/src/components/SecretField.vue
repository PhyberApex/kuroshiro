<script setup lang="ts">
import { computed, nextTick, ref, useAttrs, useId, useTemplateRef } from 'vue'
import Button from './Button.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** Whether the server holds a value. The value itself never reaches the browser, so the field only shows that there is one. */
  stored?: boolean
  disabled?: boolean
  invalid?: boolean
  /** The name of "Replace" when the page holds more than one secret: "Replace API key". */
  replaceLabel?: string
}>(), {
  replaceLabel: 'Replace',
})

/** The new secret, as typed. It stays empty until the admin types one; a stored value is never put here. */
const model = defineModel<string>({ default: '' })

const attrs = useAttrs()
const storedId = useId()
const input = useTemplateRef('input')
const replacing = ref(false)
const showsStored = computed(() => props.stored && !replacing.value && model.value === '')

// "Replace" is not the field: it takes the field's description, not its id, or a click on the label would press it.
const describedBy = computed(() => [storedId, attrs['aria-describedby']].filter(Boolean).join(' '))

async function replace() {
  replacing.value = true
  await nextTick()
  input.value?.focus()
}
</script>

<template>
  <span v-if="showsStored" class="secret-field">
    <span :id="storedId" class="control stored">
      <span aria-hidden="true">••••••••••••</span>
      <span class="visually-hidden">A value is stored and is not shown.</span>
    </span>
    <Button
      :aria-label="replaceLabel"
      :aria-describedby="describedBy"
      :disabled="disabled"
      @click="replace"
    >
      Replace
    </Button>
  </span>
  <input
    v-else
    v-bind="$attrs"
    ref="input"
    type="password"
    class="control"
    autocomplete="off"
    :value="model"
    :disabled="disabled"
    :aria-invalid="invalid || undefined"
    @input="model = ($event.target as HTMLInputElement).value"
    @blur="replacing = false"
  >
</template>

<style scoped>
@layer components {
  .secret-field {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    max-width: 100%;
  }

  .stored {
    display: inline-flex;
    align-items: center;
    border-color: var(--color-line);
    background: var(--color-wash);
    color: var(--color-ink-soft);
    letter-spacing: 0.1em;
  }
}
</style>
