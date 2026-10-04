<script setup lang="ts">
withDefaults(defineProps<{
  /** The panel of the Device Model the plate stands in for, which sets its shape. */
  width?: number
  height?: number
}>(), {
  width: 800,
  height: 480,
})

defineSlots<{
  /** What is not there yet: "Nothing polled yet". */
  default: () => unknown
}>()
</script>

<template>
  <div class="empty-plate" :style="{ aspectRatio: `${width} / ${height}` }">
    <p class="note">
      <slot />
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .empty-plate {
    display: grid;
    place-items: center;
    width: 100%;
    padding: var(--space-4);
    border-radius: var(--radius-plate);
    outline: 1px dashed var(--color-ink-soft);
    outline-offset: -1px;
    background: var(--color-wash);
  }

  .note {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-align: center;
    text-wrap: balance;
  }
}
</style>
