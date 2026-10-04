<script setup lang="ts">
import type { DeviceLogEntry } from 'kuroshiro-shared'
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import { entryLineId } from './deviceLog'
import { entryFacts, logTime, markedParts } from './deviceLogWording'

const props = defineProps<{
  entry: DeviceLogEntry
  open: boolean
  /** What is searched for, which is marked in the message. */
  sought: string
}>()

defineEmits<{
  toggle: []
}>()

const time = computed(() => logTime(new Date(props.entry.at)))
const message = computed(() => markedParts(props.entry.message, props.sought))
const facts = computed(() => entryFacts(props.entry))
const lineId = computed(() => entryLineId(props.entry.id))
const factsId = computed(() => `${lineId.value}-facts`)
</script>

<template>
  <li class="log-entry" :class="entry.level">
    <button
      :id="lineId"
      type="button"
      class="entry-line"
      :aria-expanded="open"
      :aria-controls="factsId"
      @click="$emit('toggle')"
    >
      <time class="time" :datetime="entry.at">{{ time }}</time>{{ ' ' }}
      <span class="level">{{ entry.level }}</span>{{ ' ' }}
      <span class="message"><template v-for="(part, index) in message" :key="index"><mark v-if="part.marked" class="match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>
      <Icon name="chevron" class="chevron" />
    </button>
    <div v-if="open" :id="factsId" class="carried">
      <dl v-if="facts.length > 0" class="entry-facts">
        <div v-for="(fact, index) in facts" :key="index" class="entry-fact">
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </div>
      </dl>
      <p v-else class="nothing-more">
        The Device sent nothing more with this entry.
      </p>
    </div>
  </li>
</template>

<style scoped>
@layer components {
  .log-entry {
    --time-column: 5rem;
    --level-column: 3.75rem;

    border-bottom: var(--rule);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .entry-line {
    display: grid;
    grid-template-columns: var(--time-column) var(--level-column) minmax(0, 1fr) var(--icon);
    gap: var(--space-3);
    align-items: baseline;
    width: 100%;
    min-height: var(--hit-target);
    padding: var(--space-3) 0;
    text-align: left;
    cursor: pointer;
  }

  .time,
  .level {
    color: var(--color-ink-soft);
  }

  .log-entry:is(.warning, .error) .level {
    color: var(--color-ink);
    font-weight: var(--weight-semibold);
  }

  .log-entry.error .message {
    font-weight: var(--weight-medium);
  }

  .message {
    overflow-wrap: anywhere;
  }

  .entry-line:hover .message {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .match {
    background: var(--color-ink);
    color: var(--color-paper);
  }

  .chevron {
    align-self: center;
    color: var(--color-ink-soft);
    transition:
      rotate var(--duration-move) var(--ease-out),
      color var(--duration-move) var(--ease-out);
  }

  .entry-line[aria-expanded='true'] .chevron {
    color: var(--color-ink);
    rotate: 180deg;
  }

  .carried {
    padding: 0 calc(var(--icon) + var(--space-3)) var(--space-4) calc(var(--time-column) + var(--level-column) + 2 * var(--space-3));
  }

  .entry-facts {
    display: grid;
    gap: var(--space-1);
  }

  .entry-fact {
    display: grid;
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: var(--space-3);
  }

  .entry-fact dt,
  .nothing-more {
    color: var(--color-ink-soft);
  }

  .entry-fact dt,
  .entry-fact dd {
    overflow-wrap: anywhere;
  }

  .nothing-more {
    font-family: var(--font-text);
    font-size: var(--text-sm);
  }

  @media (max-width: 820px) {
    .log-entry {
      --time-column: 4rem;
    }

    .entry-line {
      gap: var(--space-2);
    }

    .carried {
      padding-inline: 0;
    }

    .entry-fact {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }

    .entry-fact + .entry-fact {
      margin-top: var(--space-2);
    }
  }
}
</style>
