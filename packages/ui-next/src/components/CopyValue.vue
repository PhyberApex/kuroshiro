<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import Button from './Button.vue'
import { copyText } from './copyText'
import Icon from './Icon.vue'

const props = withDefaults(defineProps<{
  /** What is copied, and what is shown unless the default slot shows something else (a masked secret). */
  value: string
  /** `title` is the Server URL: the value at title size in a heavy frame, with a primary button. */
  size?: 'text' | 'title'
  label?: string
  /** Holds the copied state, for the gallery. */
  copied?: boolean
}>(), {
  size: 'text',
  label: 'Copy',
})

const COPIED_FOR_MS = 2000

const valueId = useId()
const justCopied = ref(false)
const showsCopied = computed(() => props.copied || justCopied.value)
let revert: ReturnType<typeof setTimeout> | undefined

async function copy() {
  if (!await copyText(props.value))
    return
  justCopied.value = true
  clearTimeout(revert)
  revert = setTimeout(() => {
    justCopied.value = false
  }, COPIED_FOR_MS)
}

onBeforeUnmount(() => clearTimeout(revert))
</script>

<template>
  <span class="copy-value" :class="size">
    <code :id="valueId" class="value"><slot>{{ value }}</slot></code>
    <Button
      class="copy"
      :variant="size === 'title' ? 'primary' : 'plain'"
      :aria-describedby="valueId"
      @click="copy"
    >
      <span class="faces">
        <span class="face" :class="{ shown: !showsCopied }"><Icon name="copy" />{{ label }}</span>
        <span class="face" :class="{ shown: showsCopied }"><Icon name="check" />Copied</span>
      </span>
    </Button>
    <span class="visually-hidden" role="status">{{ showsCopied ? 'Copied' : '' }}</span>
  </span>
</template>

<style scoped>
@layer components {
  .copy-value {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    max-width: 100%;
    border: var(--rule-control);
    border-radius: var(--radius);
  }

  .value {
    display: flex;
    align-items: center;
    min-width: 0;
    min-height: var(--control-height);
    padding: 0 var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .text .copy {
    min-height: 0;
    border: 0;
    border-left: var(--rule-control);
    border-radius: 0 var(--radius-inner) var(--radius-inner) 0;
  }

  .copy-value.text .copy:not(:disabled):active {
    translate: none;
  }

  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    max-width: 45rem;
    padding: var(--space-5) var(--space-6);
    border: var(--rule-heavy);
  }

  .title .value {
    min-height: 0;
    padding: 0;
    font-size: var(--title-md);
    line-height: var(--leading-title);
  }

  /* Both faces share one cell, so the button is as wide as the wider one and does not jump. */
  .faces {
    display: grid;
  }

  .face {
    display: inline-flex;
    grid-area: 1 / 1;
    align-items: center;
    gap: var(--space-2);
    visibility: hidden;
  }

  .face.shown {
    visibility: visible;
  }

  @media (max-width: 820px) {
    .title {
      padding: var(--space-4);
    }
  }
}
</style>
