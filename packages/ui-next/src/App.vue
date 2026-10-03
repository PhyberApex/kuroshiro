<script setup lang="ts">
import { version } from '../package.json'
import Seal from './components/Seal.vue'

const pathUnderBase = (path: string) => new URL(path, document.baseURI).pathname

const facts = [
  { term: 'Version', value: version },
  { term: 'Admin API', value: pathUnderBase('api') },
  { term: 'Fallback Screens', value: pathUnderBase('screens/') },
]
</script>

<template>
  <main class="page">
    <p class="lockup">
      <Seal />
      <span class="wordmark">Kuroshiro</span>
    </p>

    <h1 class="title">
      The admin UI is being rebuilt
    </h1>
    <p class="lede">
      This build carries the foundation of the new admin UI and none of its pages yet.
      Your Devices keep polling and showing their Screens; nothing here can manage them
      until the pages land.
    </p>
    <p class="lede">
      <a class="link" href="https://github.com/PhyberApex/kuroshiro/issues/1074">Follow the rebuild on GitHub</a>
    </p>

    <dl class="facts">
      <div v-for="fact in facts" :key="fact.term" class="fact">
        <dt>{{ fact.term }}</dt>
        <dd>{{ fact.value }}</dd>
      </div>
    </dl>
  </main>
</template>

<style scoped>
@layer components {
  .page {
    max-width: calc(var(--column) + 2 * var(--gutter));
    margin-inline: auto;
    padding: var(--space-16) var(--gutter);
  }

  .lockup {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
  }

  .wordmark {
    font-stretch: var(--width-title-lg);
    font-weight: var(--weight-title-lg);
    font-size: var(--title-sm);
    line-height: 1;
    letter-spacing: var(--tracking-title-lg);
  }

  .title {
    margin-top: var(--space-16);
    font-stretch: var(--width-title-lg);
    font-weight: var(--weight-title-lg);
    font-size: var(--title-lg);
    line-height: var(--leading-title-lg);
    letter-spacing: var(--tracking-title-lg);
    text-wrap: balance;
  }

  .lede {
    max-width: var(--measure);
    margin-top: var(--space-4);
    font-size: var(--text-lg);
    text-wrap: pretty;
  }

  .link {
    font-weight: var(--weight-medium);
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .link:hover {
    color: var(--color-ink-soft);
  }

  .facts {
    margin-top: var(--space-12);
    border-top: var(--rule-heavy);
  }

  .fact {
    display: grid;
    grid-template-columns: 10rem 1fr;
    gap: var(--space-4);
    padding-block: var(--space-3);
    border-bottom: var(--rule);
  }

  .fact dt {
    color: var(--color-ink-soft);
  }

  .fact dd {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  @media (max-width: 820px) {
    .page {
      padding-block: var(--space-10);
    }

    .title {
      margin-top: var(--space-10);
    }

    .fact {
      grid-template-columns: 7.5rem 1fr;
    }
  }
}
</style>
