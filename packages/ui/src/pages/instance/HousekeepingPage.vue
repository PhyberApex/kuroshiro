<script setup lang="ts">
import { getRetentionStatus } from '@/api/maintenance'
import { useLoad } from '@/patterns/useLoad'
import InstancePageBody from './InstancePageBody.vue'
import InstancePageHeading from './InstancePageHeading.vue'
import RetentionSection from './RetentionSection.vue'
import { useStoredFiles } from './storedFiles'
import StoredFilesSection from './StoredFilesSection.vue'

const retention = useLoad(getRetentionStatus)
const storedFiles = useStoredFiles()
</script>

<template>
  <InstancePageHeading title="Housekeeping" />
  <InstancePageBody>
    <template #lede>
      What Kuroshiro keeps that nothing needs any more, and what removes it.
    </template>
    <StoredFilesSection class="first" :stored-files="storedFiles" />
    <RetentionSection :retention="retention" />
  </InstancePageBody>
</template>
