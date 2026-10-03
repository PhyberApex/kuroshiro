<script setup lang="ts">
import { version } from '../package.json'

const adminApiPath = new URL('api', document.baseURI).pathname

const facts = [
  { term: 'Version', value: version },
  { term: 'Admin API', value: adminApiPath },
  { term: 'Fallback Screens', value: new URL('screens/', document.baseURI).pathname },
]
</script>

<template>
  <main class="page">
    <p class="lockup">
      <svg class="seal" viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
        <rect width="64" height="64" rx="5" />
        <path class="characters" d="M13.77 31.8Q12.98 31.33 11.65 30.77Q10.31 30.21 9.18 29.94Q10.36 29.42 11.7 28.57Q13.03 27.72 14.22 26.82Q15.4 25.92 16.14 25.23H9.82V22.66H29.09V21.35H13.08V18.97H29.09V17.57H15.01V7.28H49.04V17.57H34.87V18.97H50.87V21.35H34.87V22.66H54.23V25.23H47.96Q49.78 26.3 51.56 27.58Q53.34 28.87 54.48 29.88Q53.79 30.07 52.82 30.39Q51.86 30.7 50.99 31.06Q50.13 31.42 49.59 31.69Q48.89 30.95 47.73 29.99Q46.57 29.03 45.29 28.08Q44 27.12 42.82 26.44L45.98 25.23H16.54L21.13 26.68Q19.7 28.05 17.7 29.47Q15.7 30.9 13.77 31.8ZM35.8 31.55Q35.56 30.76 35.14 29.81Q34.72 28.87 34.27 27.94Q33.83 27.01 33.33 26.33L38.62 25.53Q39.11 26.16 39.66 27.08Q40.2 28 40.65 28.97Q41.09 29.94 41.34 30.76Q40.3 30.84 38.59 31.07Q36.89 31.31 35.8 31.55ZM25.38 31.69Q25.28 30.92 25.01 29.95Q24.74 28.98 24.42 28.04Q24.1 27.09 23.7 26.41L29.09 25.81Q29.53 26.46 29.93 27.39Q30.32 28.32 30.62 29.31Q30.91 30.29 31.06 31.09Q29.97 31.14 28.25 31.31Q26.52 31.47 25.38 31.69ZM20.59 11.31H29.09V9.66H20.59ZM34.87 11.31H43.31V9.66H34.87ZM20.59 15.19H29.09V13.58H20.59ZM34.87 15.19H43.31V13.58H34.87ZM14.22 58.96V39.59H25.33Q25.87 38.93 26.47 38.05Q27.06 37.18 27.58 36.33Q28.1 35.48 28.34 34.88L35.66 35.26Q35.26 35.87 34.69 36.65Q34.12 37.43 33.51 38.21Q32.89 38.98 32.35 39.59H49.98V58.96ZM20.49 56.03H43.71V50.56H20.49ZM20.49 47.69H43.71V42.51H20.49Z" />
      </svg>
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

  .seal {
    flex: none;
    fill: var(--color-seal);
  }

  .seal .characters {
    fill: var(--color-paper);
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
