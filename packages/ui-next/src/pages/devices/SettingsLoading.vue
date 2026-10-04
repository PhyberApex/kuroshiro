<script setup lang="ts">
import PageSection from '@/patterns/PageSection.vue'
import WashBar from '@/patterns/WashBar.vue'

const SECTIONS = [
  { title: 'Display', rows: ['38%', '52%', '34%', '44%'] },
  { title: 'Sleep Mode', rows: ['18%'] },
  { title: 'Firmware', rows: ['14%', '48%'] },
  { title: 'Mirroring', rows: ['18%'] },
]
</script>

<template>
  <div class="settings-loading" aria-hidden="true">
    <PageSection v-for="section in SECTIONS" :key="section.title" class="section" :title="section.title" rows>
      <div v-for="(width, index) in section.rows" :key="index" class="row">
        <WashBar width="45%" />
        <WashBar :width="width" />
      </div>
    </PageSection>
  </div>
</template>

<style scoped>
@layer components {
  .settings-loading .section:first-child {
    margin-top: var(--space-4);
  }

  .row + .row {
    border-top: var(--rule);
  }

  .row {
    display: grid;
    grid-template-columns: var(--setting-label-width, 12.5rem) minmax(0, 1fr);
    align-items: center;
    gap: var(--space-4);
    min-height: 3.25rem;
  }

  @media (max-width: 820px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
      align-content: center;
      gap: var(--space-2);
    }
  }
}
</style>
