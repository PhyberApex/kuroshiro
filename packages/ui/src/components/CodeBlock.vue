<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from './Button.vue'
import CopyFaces from './CopyFaces.vue'
import { useCopied } from './useCopied'

const props = withDefaults(defineProps<{
  /** The code or data shown, as text. */
  code: string
  /** Adds the "Copy" button. */
  copy?: boolean
  /** What "Copy" writes when it is more than what is shown, such as a command with its token written out. */
  copyValue?: string
  copyLabel?: string
  /** Folds a block of more lines than this to its first lines, under a button that shows them all. */
  foldAfter?: number
  /** Holds the copied state, for the gallery. */
  copied?: boolean
}>(), {
  copyLabel: 'Copy',
})

const lines = computed(() => props.code.replace(/\n$/, '').split('\n'))
const foldable = computed(() => props.foldAfter !== undefined && lines.value.length > props.foldAfter)
const unfolded = ref(false)
const shown = computed(() => foldable.value && !unfolded.value
  ? lines.value.slice(0, props.foldAfter).join('\n')
  : lines.value.join('\n'))

const { copy: copyCode, showsCopied } = useCopied(() => props.copyValue ?? props.code, () => props.copied)
</script>

<template>
  <div class="code-block" :class="{ copyable: copy }">
    <pre class="code" tabindex="0"><code>{{ shown }}</code></pre>
    <Button v-if="copy" class="copy" @click="copyCode">
      <CopyFaces :label="copyLabel" :copied="showsCopied" />
    </Button>
    <div v-if="foldable" class="fold">
      <Button variant="quiet" :aria-expanded="unfolded" @click="unfolded = !unfolded">
        {{ unfolded ? `Show the first ${foldAfter} lines` : `Show all ${lines.length} lines` }}
      </Button>
    </div>
    <span v-if="copy" class="visually-hidden" role="status">{{ showsCopied ? 'Copied' : '' }}</span>
  </div>
</template>

<style scoped>
@layer components {
  .code-block {
    position: relative;
    border: var(--rule);
    border-radius: var(--radius);
    background: var(--color-wash);
  }

  /* It scrolls sideways, and `tabindex="0"` makes it reachable by keyboard to be scrolled by it. */
  .code {
    margin: 0;
    padding: var(--space-3);
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.6;
    white-space: pre;
  }

  .code code {
    font: inherit;
  }

  /* Room at the end of the first lines, so the button does not sit on a short line and a long one scrolls clear of it. */
  .copyable .code {
    padding-inline-end: 6.5rem;
  }

  .code-block .copy {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    background: var(--color-paper);
  }

  .fold {
    padding: 0 var(--space-3);
    border-top: var(--rule);
  }
}
</style>
