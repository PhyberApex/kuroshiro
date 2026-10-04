<script setup lang="ts">
import type { SelectOption } from '@/components/selectOption'
import { useId } from 'vue'
import Select from '@/components/Select.vue'

const props = defineProps<{
  /** The slots of the layout by name, in slot order. */
  slotNames: string[]
  /** The Plugin in each slot, in slot order; `null` for a slot that is still to be filled. */
  pluginIds: (string | null)[]
  /** Every Plugin a slot can hold. */
  plugins: { id: string, name: string }[]
}>()

defineEmits<{
  /** The slot is to hold another Plugin. */
  change: [slot: number, pluginId: string]
}>()

const id = useId()

/** A Plugin fills one slot at most, so the one in another slot cannot be chosen here. */
function optionsOf(slot: number): SelectOption[] {
  return props.plugins.map((plugin) => {
    const inAnotherSlot = props.pluginIds.some((held, other) => held === plugin.id && other !== slot)
    return { value: plugin.id, label: plugin.name, disabled: inAnotherSlot, reason: inAnotherSlot ? 'In another slot' : undefined }
  })
}
</script>

<template>
  <ul class="slots">
    <li v-for="(name, slot) in slotNames" :key="name" class="slot">
      <span :id="`${id}-${slot}`" class="slot-name">{{ name }}</span>
      <Select
        class="plugin"
        :model-value="pluginIds[slot] ?? null"
        :options="optionsOf(slot)"
        placeholder="Choose"
        :aria-labelledby="`${id}-${slot}`"
        @update:model-value="pluginId => pluginId && $emit('change', slot, pluginId)"
      />
    </li>
  </ul>
</template>

<style scoped>
@layer components {
  .slots {
    border-top: var(--rule);
  }

  .slot {
    display: grid;
    grid-template-columns: 6.5rem minmax(0, 1fr);
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-1) 0;
    border-bottom: var(--rule);
  }

  .slot-name {
    color: var(--color-ink-soft);
  }

  .slots .plugin {
    width: 100%;
    min-width: 0;
  }
}
</style>
