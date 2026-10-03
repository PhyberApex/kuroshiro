<script setup lang="ts">
import type { Fact } from './fact'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import LoadingMark from './LoadingMark.vue'

const props = defineProps<{
  facts: Fact[]
}>()

const said = computed(() => props.facts.filter(fact => fact.value?.trim()))
</script>

<template>
  <dl v-if="said.length > 0" class="fact-rows">
    <div v-for="fact in said" :key="fact.label" class="fact" :class="{ alert: fact.alert }">
      <dt class="label">
        <span v-if="fact.alert" class="square" aria-hidden="true" />{{ fact.alert ?? fact.label }}
      </dt>
      <dd class="value">
        <LoadingMark v-if="fact.pending" decorative />
        <RouterLink v-if="fact.to" class="link" :to="fact.to">
          {{ fact.value }}
        </RouterLink>
        <template v-else>
          {{ fact.value }}
        </template>
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

  .square {
    display: inline-block;
    width: var(--space-2);
    height: var(--space-2);
    margin-right: var(--space-2);
    background: var(--color-seal);
  }

  .link {
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .link:hover {
    color: var(--color-ink-hover);
  }

  @media (pointer: coarse) {
    .link {
      display: inline-flex;
      align-items: center;
      min-height: var(--hit-target);
    }
  }
}
</style>
