<script setup lang="ts">
import type { AlertSummary } from 'kuroshiro-shared'
import type { AlertTold } from './alertWording'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import SentenceLine from '@/pages/devices/SentenceLine.vue'
import { FIRING_ALERT_LABELS, RESOLVED_ALERT_LABELS } from './alertLabels'
import { alertSubject, alertWhy, firedFor, sinceWhen } from './alertWording'

const props = defineProps<{
  alert: AlertSummary
  told: AlertTold
}>()

const firing = computed(() => props.alert.resolvedAt === null)
const label = computed(() => (firing.value ? FIRING_ALERT_LABELS : RESOLVED_ALERT_LABELS)[props.alert.kind])
const subject = computed(() => alertSubject(props.alert))
const why = computed(() => alertWhy(props.alert, props.told))
const when = computed(() => firing.value ? sinceWhen(props.alert.openedAt, props.told.now) : firedFor(props.alert, props.told.now))
</script>

<template>
  <li class="alert-row" :class="{ firing }">
    <p class="kind">
      <span v-if="firing" class="square" aria-hidden="true" />{{ label }}
    </p>
    <p class="subject">
      <RouterLink v-slot="{ href, navigate }" custom :to="subject.to">
        <a class="open" :href="href" @click="navigate">{{ subject.name }}<template v-if="subject.dataSource"> · <span class="source">{{ subject.dataSource }}</span></template></a>
      </RouterLink>
    </p>
    <SentenceLine class="why" :sentence="why" />
    <p class="when">
      <time :datetime="alert.openedAt">{{ when }}</time>
    </p>
  </li>
</template>

<style scoped>
@layer components {
  .alert-row {
    display: grid;
    grid-template-columns: 11.5rem minmax(0, 14rem) minmax(0, 1fr) auto;
    align-items: baseline;
    gap: var(--space-1) var(--space-4);
    min-height: 3.25rem;
    padding: var(--space-3) 0;
    border-bottom: var(--rule);
  }

  .kind {
    font-weight: var(--weight-medium);
  }

  /* The seal colour is rationed: of a row, only the name of an Alert that fires wears it. */
  .alert-row.firing .kind {
    color: var(--color-seal);
    font-weight: var(--weight-semibold);
  }

  .square {
    display: inline-block;
    width: var(--space-2);
    height: var(--space-2);
    margin-right: var(--space-2);
    background: var(--color-seal);
  }

  .subject {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .open {
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .open:hover {
    color: var(--color-ink-hover);
  }

  .alert-row.firing .open {
    font-weight: var(--weight-medium);
  }

  .source {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .alert-row .why,
  .when {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .alert-row .why {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .when {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  @media (pointer: coarse) {
    .open {
      display: inline-block;
      padding-block: calc((var(--hit-target) - 1lh) / 2);
    }
  }

  /* Stacked: the Alert, then its subject with the time beside it, then why. */
  @media (max-width: 820px) {
    .alert-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .kind,
    .alert-row .why {
      grid-column: 1 / -1;
    }

    .when {
      grid-area: 2 / 2;
    }

    .alert-row .why {
      grid-row: 3;
    }
  }
}
</style>
