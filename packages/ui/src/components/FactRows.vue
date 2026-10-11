<script setup lang="ts" generic="T extends Fact">
import type { Fact } from './fact'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import LoadingMark from './LoadingMark.vue'

const props = defineProps<{
  facts: T[]
}>()

defineSlots<{
  /** In place of a fact's value as text, for one that is more than words: a time with its tooltip. */
  value?: (props: { fact: T }) => unknown
}>()

const said = computed(() => props.facts.filter(fact => fact.value?.trim()))
</script>

<template>
  <dl v-if="said.length > 0" class="fact-rows">
    <div v-for="fact in said" :key="fact.label" class="fact" :class="{ alert: fact.alert }">
      <dt class="label">
        <span v-if="fact.alert" class="seal-dot" aria-hidden="true" />{{ fact.alert ?? fact.label }}
      </dt>
      <dd class="value">
        <LoadingMark v-if="fact.pending" decorative />
        <RouterLink v-if="fact.to" class="link row-link" :to="fact.to">
          <slot name="value" :fact="fact">
            {{ fact.value }}
          </slot>
        </RouterLink>
        <slot v-else name="value" :fact="fact">
          {{ fact.value }}
        </slot>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
@layer components {
  .fact-rows {
    border-top: var(--rule-heavy);
  }

  .fact {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) 0;
    border-bottom: var(--rule);
  }

  .label {
    color: var(--color-ink-soft);
    white-space: nowrap;
  }

  .value {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-align: right;
    overflow-wrap: anywhere;
  }

  /* The seal colour is rationed: of all the facts, only one a firing Alert stands behind wears it. */
  .fact.alert :is(.label, .value) {
    color: var(--color-seal);
    font-weight: var(--weight-medium);
  }
}
</style>
