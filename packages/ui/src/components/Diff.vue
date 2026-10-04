<script setup lang="ts">
import type { DiffEntry, DiffLine } from './diffLines'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { diffLines, foldRuns } from './diffLines'

const props = withDefaults(defineProps<{
  /** The value before the change, one entry per line. Empty for something added. */
  before: string[]
  /** The value after it. Empty for something removed. */
  after: string[]
  /** What the list is called: "The Recipe's change to Template full". */
  label: string
  /** Folds long runs of unchanged lines. Off for a value shown whole, where every line is unchanged. */
  fold?: boolean
}>(), {
  fold: true,
})

const SIGNS: Record<DiffLine['kind'], string> = { same: '', removed: '−', added: '+' }
const SPOKEN: Record<DiffLine['kind'], string> = { same: '', removed: 'removed: ', added: 'added: ' }

const list = useTemplateRef<HTMLOListElement>('list')
const opened = ref(new Set<number>())

const lines = computed(() => diffLines(props.before, props.after))
const folded = computed<DiffEntry[]>(() => props.fold ? foldRuns(lines.value) : lines.value)

/** What is shown, each with the place of its entry among `folded`, which an opened run keeps. */
const shown = computed(() => folded.value.flatMap((entry, place) =>
  entry.kind === 'folded' && opened.value.has(place)
    ? entry.lines.map(line => ({ entry: line as DiffEntry, place }))
    : [{ entry, place }]))

async function open(place: number) {
  opened.value = new Set([...opened.value, place])
  await nextTick()
  list.value?.focus()
}
</script>

<template>
  <ol ref="list" class="diff" tabindex="0" :aria-label="label">
    <template v-for="({ entry, place }, index) in shown" :key="index">
      <li v-if="entry.kind === 'folded'" class="folded">
        <button type="button" class="open-run" @click="open(place)">
          … {{ entry.lines.length }} lines the same
        </button>
      </li>
      <li v-else class="line" :class="entry.kind">
        <span class="sign" aria-hidden="true">{{ SIGNS[entry.kind] }}</span>
        <span v-if="SPOKEN[entry.kind]" class="visually-hidden">{{ SPOKEN[entry.kind] }}</span>
        <span class="text">{{ entry.text }}</span>
      </li>
    </template>
  </ol>
</template>

<style scoped>
@layer components {
  /* It scrolls sideways, and `tabindex="0"` makes it reachable by keyboard to be scrolled by it. */
  .diff {
    display: grid;
    grid-template-columns: minmax(max-content, 1fr);
    margin: 0;
    padding: var(--space-1) 0;
    overflow-x: auto;
    border: var(--rule);
    border-radius: var(--radius);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.7;
    list-style: none;
  }

  .line {
    display: grid;
    grid-template-columns: 1.75rem max-content;
    padding-inline-end: var(--space-3);
    white-space: pre;
  }

  .sign {
    text-align: center;
  }

  .removed {
    color: var(--color-ink-soft);
  }

  .removed .text {
    text-decoration: line-through;
  }

  .added {
    background: var(--color-wash);
    font-weight: var(--weight-semibold);
  }

  .folded {
    border-block: var(--rule);
  }

  .folded:first-child {
    border-top: 0;
  }

  .folded:last-child {
    border-bottom: 0;
  }

  .open-run {
    width: 100%;
    padding: 0 var(--space-3) 0 var(--space-2);
    color: var(--color-ink-soft);
    text-align: start;
  }

  .open-run:hover {
    color: var(--color-ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}
</style>
