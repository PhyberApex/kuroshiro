<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import { UPLOAD_FIRMWARE_PATH } from './instancePaths'

defineProps<{
  syncing: boolean
}>()

defineEmits<{
  sync: []
}>()
</script>

<template>
  <EmptyState class="no-firmware" title="No Firmware yet" heading="h3">
    Kuroshiro fetches the official Firmware from TRMNL when it starts and every day at 04:00. This Instance has not reached TRMNL yet.
    <template #action>
      <div class="ways">
        <Button variant="primary" :disabled="syncing" @click="$emit('sync')">
          Sync from TRMNL
        </Button>
        <Button as-child>
          <RouterLink :to="UPLOAD_FIRMWARE_PATH">
            Upload Firmware
          </RouterLink>
        </Button>
      </div>
    </template>
  </EmptyState>
</template>

<style scoped>
@layer components {
  .no-firmware {
    margin-top: var(--space-10);
  }

  .ways {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}
</style>
