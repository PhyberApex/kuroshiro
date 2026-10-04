<script setup lang="ts">
import type { CodeEditorMode, CodeProblem } from './codeEditor'
import { computed } from 'vue'
import Button from './Button.vue'
import { MODE_LABELS } from './codeEditor'
import Icon from './Icon.vue'

const props = defineProps<{
  mode: CodeEditorMode
  /** Takes the place of the hint and the mode. */
  problem: CodeProblem | null
  /** Takes the hint's place. */
  note?: string
}>()

defineEmits<{
  goToProblem: []
}>()

const lineWords = computed(() => props.problem?.line == null ? '' : `Line ${props.problem.line}: `)
</script>

<template>
  <div class="strip">
    <p class="problem" role="status">
      <template v-if="problem">
        <Icon name="problem" class="mark" />
        <span>{{ lineWords }}<code class="message">{{ problem.message }}</code></span>
      </template>
    </p>
    <Button v-if="problem && problem.line !== null" class="go" variant="quiet" @click="$emit('goToProblem')">
      Go to line {{ problem.line }}
    </Button>
    <template v-if="!problem">
      <p v-if="note" class="hint">
        {{ note }}
      </p>
      <p v-else class="hint">
        <kbd>Tab</kbd> indents. <kbd>Esc</kbd> then <kbd>Tab</kbd> moves on.
      </p>
      <span class="mode">{{ MODE_LABELS[mode] }}</span>
    </template>
  </div>
</template>

<style scoped>
@layer components {
  .strip {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-1) var(--space-4);
    min-height: 2rem;
    padding: var(--space-1) var(--space-3);
    border-top: var(--rule);
    color: var(--color-ink-soft);
    font-size: var(--text-xs);
  }

  .problem {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    min-width: 0;
    color: var(--color-ink);
    font-size: var(--text-sm);
  }

  /* The region stays in the page while it has nothing to say, so that what it says next is announced. */
  .problem:empty {
    position: absolute;
  }

  .mark {
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .message {
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }

  .go {
    flex: none;
    min-height: 0;
  }

  .hint kbd {
    padding: 0 3px;
    border: var(--rule);
    border-radius: var(--radius-inner);
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: 0.95em;
  }

  .mode {
    flex: none;
  }

  @media (pointer: coarse) {
    .go {
      min-height: var(--hit-target);
    }
  }
}
</style>
