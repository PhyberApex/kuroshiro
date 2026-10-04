<script setup lang="ts">
import { ref, watch } from 'vue'
import { updateSchedule } from '@/api/screens'
import SaveState from '@/components/SaveState.vue'
import Switch from '@/components/Switch.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'

const props = defineProps<{
  screenId: string
  /** Whether the Screen's Schedule is on, as the server has it. */
  enabled: boolean
  /** The switch's name: "Schedule for Weekend board". */
  label: string
  /** Reads the Screens again, after a write to this one. */
  reload: () => Promise<void>
  /** The switch stands at the end of its line, the save state before it. */
  trailing?: boolean
}>()

defineSlots<{
  /** What stands between the switch and its save state: the row's Schedule summary. */
  default?: () => unknown
}>()

const on = ref(props.enabled)

const save = useSaveAsChanged(async (enabled) => {
  const saved = await updateSchedule(props.screenId, { enabled })
  await props.reload()
  return saved.schedule?.enabled
}, on)

// The row's switch and the editor's are two of these: what one saved is what the other shows.
watch(() => props.enabled, (saved) => {
  if (save.status === 'saving')
    return
  on.value = saved
  save.reset()
})

function choose(enabled: boolean) {
  on.value = enabled
  save.commit()
}
</script>

<template>
  <span class="schedule-switch" :class="{ trailing }">
    <Switch :model-value="on" :saving="save.status === 'saving'" :error="save.status === 'failed'" :aria-label="label" @update:model-value="choose" />
    <slot />
    <SaveState :status="save.status" :reason="save.reason" @retry="save.retry" />
  </span>
</template>

<style scoped>
@layer components {
  .schedule-switch {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--space-3);
    min-width: 0;
  }

  .schedule-switch.trailing {
    flex-direction: row-reverse;
  }
}
</style>
