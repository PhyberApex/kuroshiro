<script setup lang="ts">
import type { NavItem } from '@/components/navItem'
import { watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'

const props = defineProps<{
  /** What is missing: "No Device here". */
  title: string
  /** The one link back: `{ label: 'All Devices', to: '/devices' }`. */
  back: NavItem
}>()

defineSlots<{
  /** Why it may be missing: "It may have been deleted." */
  default?: () => unknown
}>()

watchEffect(() => {
  document.title = `${props.title} · Kuroshiro`
})
</script>

<template>
  <EmptyState :title="title" page>
    <slot />
    <template #action>
      <Button as-child>
        <RouterLink :to="back.to">
          {{ back.label }}
        </RouterLink>
      </Button>
    </template>
  </EmptyState>
</template>
