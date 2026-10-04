<script setup lang="ts" generic="T">
import type { Load } from './useLoad'
import Notice from '@/components/Notice.vue'
import LoadingLine from './LoadingLine.vue'

defineProps<{
  /** What `useLoad` gave back. */
  load: Load<T>
  /** The loading line: "Loading Devices". */
  loading: string
  /** What could not be loaded, as a sentence: "Could not load the Devices." */
  failed: string
}>()

defineSlots<{
  /** The body, once there is data. It stays through a refresh and under a later failure. */
  default: (props: { data: T }) => unknown
  /** The body's real structure with nothing in it: a rendering `Plate` where an image will be, `WashBar`s where text will be. */
  skeleton?: () => unknown
}>()
</script>

<template>
  <Notice
    v-if="load.failure"
    class="failed"
    :title="failed"
    :reason="load.failure.reason"
    action="Try again"
    @act="load.reload"
  />
  <slot v-if="load.data !== undefined" :data="load.data" />
  <div v-else class="waiting">
    <LoadingLine :shown="load.waiting">
      {{ loading }}
    </LoadingLine>
    <slot v-if="load.waiting" name="skeleton" />
  </div>
</template>

<style scoped>
@layer components {
  .failed {
    margin-bottom: var(--space-6);
  }

  .waiting {
    display: grid;
    gap: var(--space-4);
  }
}
</style>
