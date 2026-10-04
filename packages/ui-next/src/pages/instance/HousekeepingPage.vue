<script setup lang="ts">
import { getRetentionStatus } from '@/api/maintenance'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import WashBar from '@/patterns/WashBar.vue'
import InstancePageHeading from './InstancePageHeading.vue'
import RetentionSection from './RetentionSection.vue'
import { useStoredFiles } from './storedFiles'
import StoredFilesSection from './StoredFilesSection.vue'

const retention = useLoad(getRetentionStatus)
const storedFiles = useStoredFiles()

const SKELETON_LINE_WIDTHS = ['70%', '55%', '62%']
</script>

<template>
  <InstancePageHeading title="Housekeeping" />
  <div class="body">
    <LoadBody :load="retention" loading="Loading Housekeeping" failed="Could not load Housekeeping.">
      <template #skeleton>
        <div class="skeleton" aria-hidden="true">
          <WashBar v-for="width in SKELETON_LINE_WIDTHS" :key="width" :width="width" />
        </div>
      </template>
      <template #default="{ data }">
        <p class="lede">
          What Kuroshiro keeps that nothing needs any more, and what removes it.
        </p>
        <StoredFilesSection class="first" :stored-files="storedFiles" />
        <RetentionSection :status="data" @ran="retention.reload" />
      </template>
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  .body {
    margin-top: var(--space-3);
  }

  .lede {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .body .first {
    margin-top: var(--space-8);
  }

  .skeleton {
    display: grid;
    gap: var(--space-4);
  }
}
</style>
