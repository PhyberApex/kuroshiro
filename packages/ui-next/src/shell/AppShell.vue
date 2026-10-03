<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import { useAlerts, useDevices, useInstanceFacts } from '@/reads/sharedReads'
import Bar from './Bar.vue'
import BottomTabs from './BottomTabs.vue'

const instanceFacts = useInstanceFacts()
const devices = useDevices()
const alerts = useAlerts()

const listedDevices = computed(() => devices.data ?? [])
const firingAlerts = computed(() => alerts.data?.active.length ?? 0)
</script>

<template>
  <Bar class="bar-place" :devices="listedDevices" :firing-alerts="firingAlerts" />
  <p v-if="instanceFacts.data?.demoMode" class="demo-line">
    This is the Kuroshiro demo. Image uploads are off, and anyone can change what you see here.
  </p>
  <main class="page">
    <RouterView />
  </main>
  <BottomTabs class="tabs-place" :devices="listedDevices" />
</template>

<style scoped>
@layer components {
  .bar-place {
    position: sticky;
    top: 0;
    z-index: var(--layer-bar);
  }

  .demo-line {
    padding: var(--space-2) var(--gutter);
    border-bottom: var(--rule);
    background: var(--color-wash);
    font-size: var(--text-sm);
    text-align: center;
    text-wrap: balance;
  }

  /* The one centred column. What a page renders at its root is a direct child of it. */
  .page {
    max-width: calc(var(--column) + 2 * var(--gutter));
    margin-inline: auto;
    padding: var(--space-10) var(--gutter) var(--space-16);
  }

  .tabs-place {
    position: fixed;
    inset: auto 0 0;
    z-index: var(--layer-bar);
  }

  @media (max-width: 820px) {
    .page {
      padding-block: var(--space-6) calc(var(--bar-height) + env(safe-area-inset-bottom) + var(--space-12));
    }
  }
}
</style>
