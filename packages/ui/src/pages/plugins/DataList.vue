<script setup lang="ts">
import type { DataRow } from './templateData'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import CodeBlock from '@/components/CodeBlock.vue'
import Icon from '@/components/Icon.vue'

/** Every name a Template can read, one row each: a plain value in its row, an object or a list opening in place to its JSON. */
defineProps<{
  rows: DataRow[]
}>()
</script>

<template>
  <ul class="data-list">
    <li v-for="row in rows" :key="row.name" class="row">
      <CollapsibleRoot v-if="row.code">
        <CollapsibleTrigger as-child>
          <button type="button" class="line opens">
            <span class="name">{{ row.name }}</span>
            <span class="from" :class="{ problem: row.notFetched }">
              <Icon v-if="row.notFetched" name="problem" />
              {{ row.origin }}
            </span>
            <Icon name="chevron" class="chevron" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent as-child>
          <div class="opened">
            <p v-if="row.why" class="why">
              {{ row.why }}
            </p>
            <CodeBlock class="json" :code="row.code" />
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
      <div v-else class="line">
        <span class="name">{{ row.name }}</span>
        <span class="from">
          <span class="value">{{ row.value }}</span>
          {{ ' ' }}·
          {{ row.origin }}
        </span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
@layer components {
  .data-list {
    border-top: var(--rule);
  }

  .row {
    border-bottom: var(--rule);
  }

  /* The last column is the chevron's, kept on a row without one so that every origin ends on the same edge. */
  .line {
    display: grid;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr) var(--icon);
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    width: 100%;
    padding: var(--space-2) 0;
    font-size: var(--text-sm);
    text-align: left;
  }

  .name {
    font-family: var(--font-mono);
    font-weight: var(--weight-semibold);
    overflow-wrap: anywhere;
  }

  .opens:hover .name {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .from {
    min-width: 0;
    overflow: hidden;
    color: var(--color-ink-soft);
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A problem is ink with the problem icon, never red. */
  .from.problem {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .value {
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .chevron {
    align-self: center;
    color: var(--color-ink-soft);
    transition: rotate var(--duration-move) var(--ease-out);
  }

  .opens[data-state='open'] .chevron {
    color: var(--color-ink);
    rotate: 180deg;
  }

  .opened {
    padding-bottom: var(--space-3);
  }

  .why {
    max-width: var(--measure);
    margin-bottom: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  /* A long object scrolls inside its block rather than lengthening the list. */
  .json :deep(.code) {
    max-height: 14rem;
    overflow-y: auto;
  }

  @media (pointer: coarse) {
    .opens {
      min-height: var(--hit-target);
      align-items: center;
    }
  }
}
</style>
