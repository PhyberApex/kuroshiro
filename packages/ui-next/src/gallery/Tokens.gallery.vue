<script setup lang="ts">
const colours = [
  { token: '--color-paper', use: 'The page' },
  { token: '--color-ink', use: 'Text, rules that carry weight, the filled button' },
  { token: '--color-ink-hover', use: 'Ink under the pointer' },
  { token: '--color-ink-soft', use: 'Secondary text, a control\'s border' },
  { token: '--color-line', use: 'Hairlines between rows' },
  { token: '--color-wash', use: 'A quiet fill: a loading bar, a hovered row' },
  { token: '--color-seal', use: 'The seal and a firing Alert, nothing else' },
  { token: '--color-scrim', use: 'Behind a dialog' },
  { token: '--color-plate', use: 'A Screen image\'s paper; the same in both themes' },
  { token: '--color-plate-ink', use: 'A Screen image\'s ink; the same in both themes' },
]

const titles = [
  { token: '--title-lg', sample: 'Kitchen', style: 'title-lg' },
  { token: '--title-md', sample: 'Screens on this Device', style: 'title' },
  { token: '--title-sm', sample: 'Rotation', style: 'title' },
]

const texts = [
  { token: '--text-lg', sample: 'Polls every 15 minutes and shows the next Screen in its Rotation.' },
  { token: '--text-md', sample: 'Polls every 15 minutes and shows the next Screen in its Rotation.' },
  { token: '--text-sm', sample: 'Polls every 15 minutes and shows the next Screen in its Rotation.' },
  { token: '--text-xs', sample: 'Polls every 15 minutes and shows the next Screen in its Rotation.' },
]

const spaces = ['1', '2', '3', '4', '5', '6', '8', '10', '12', '16'].map(step => `--space-${step}`)
</script>

<template>
  <div class="tokens">
    <h3 class="group">
      Colour
    </h3>
    <ul class="rows">
      <li v-for="colour in colours" :key="colour.token" class="row colour">
        <span class="chip" :style="{ background: `var(${colour.token})` }" />
        <code>{{ colour.token }}</code>
        <span class="use">{{ colour.use }}</span>
      </li>
    </ul>

    <h3 class="group">
      Type scale
    </h3>
    <ul class="rows">
      <li v-for="title in titles" :key="title.token" class="row specimen">
        <code>{{ title.token }}</code>
        <span :class="title.style" :style="{ fontSize: `var(${title.token})` }">{{ title.sample }}</span>
      </li>
      <li v-for="text in texts" :key="text.token" class="row specimen">
        <code>{{ text.token }}</code>
        <span :style="{ fontSize: `var(${text.token})` }">{{ text.sample }}</span>
      </li>
      <li class="row specimen">
        <code>--font-mono</code>
        <span class="mono">A4:C1:38:5F:0B:9E</span>
      </li>
    </ul>

    <h3 class="group">
      Space
    </h3>
    <ul class="rows">
      <li v-for="space in spaces" :key="space" class="row space">
        <code>{{ space }}</code>
        <span class="bar" :style="{ width: `var(${space})` }" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
@layer components {
  .group {
    margin-top: var(--space-8);
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }

  .rows {
    margin-top: var(--space-2);
    border-top: var(--rule);
  }

  .row {
    display: grid;
    align-items: center;
    gap: var(--space-1) var(--space-4);
    padding-block: var(--space-3);
    border-bottom: var(--rule);
  }

  .row code {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .colour {
    grid-template-columns: var(--space-10) 11rem 1fr;
  }

  .chip {
    height: var(--space-6);
    border: var(--rule-control);
    border-radius: var(--radius-inner);
  }

  .use {
    color: var(--color-ink-soft);
  }

  .specimen {
    grid-template-columns: 11rem 1fr;
    align-items: baseline;
  }

  .title {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    line-height: var(--leading-title);
  }

  .title-lg {
    font-stretch: var(--width-title-lg);
    font-weight: var(--weight-title-lg);
    line-height: var(--leading-title-lg);
    letter-spacing: var(--tracking-title-lg);
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .space {
    grid-template-columns: 11rem 1fr;
    padding-block: var(--space-2);
  }

  .bar {
    height: var(--space-3);
    background: var(--color-ink);
  }

  @media (max-width: 820px) {
    .colour {
      grid-template-columns: var(--space-10) 1fr;
    }

    .use {
      grid-column: 2;
    }

    .specimen {
      grid-template-columns: 1fr;
    }

    .space {
      grid-template-columns: 9.5rem 1fr;
    }
  }
}
</style>
