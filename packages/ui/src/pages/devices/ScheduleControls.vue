<script setup lang="ts">
import type { ScheduleInput, ScheduleRead } from 'kuroshiro-shared'
import type { Weekday } from '@/components/WeekdayToggle.vue'
import { computed, ref, watch } from 'vue'
import { updateSchedule } from '@/api/screens'
import SaveState from '@/components/SaveState.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import WeekdayToggle from '@/components/WeekdayToggle.vue'
import { useNow } from '@/patterns/useNow'
import { useServerTimezone } from '@/reads/sharedReads'
import ScheduleDates from './ScheduleDates.vue'
import { dateInZone, selectedWeekdays, timezoneLine } from './scheduleEditing'
import ScheduleHours from './ScheduleHours.vue'

const props = defineProps<{
  screenId: string
  schedule: ScheduleRead
  /** Reads the Screens again, after a write to this one. */
  reload: () => Promise<void>
}>()

const now = useNow()
const timezone = useServerTimezone()
const today = computed(() => timezone.value && dateInZone(now.value, timezone.value))

/** What the controls ask to save. It grows until a save goes through, so a change made during a save or after a failed one is saved with what came before it. */
const entered = ref<ScheduleInput>({})

const save = useSaveAsChanged(async (input) => {
  await updateSchedule(props.screenId, input)
  await props.reload()
}, entered)

const unsettled = computed(() => save.status === 'saving' || save.status === 'failed')

function send(input: ScheduleInput) {
  entered.value = unsettled.value ? { ...entered.value, ...input } : input
  save.commit()
}

const days = ref(selectedWeekdays(props.schedule.weekdays))

watch(() => props.schedule.weekdays?.join(), () => {
  if (!unsettled.value)
    days.value = selectedWeekdays(props.schedule.weekdays)
})

/** No day selected would mean every day, so the last selected day stays. */
function chooseDays(chosen: Weekday[]) {
  if (chosen.length === 0)
    return
  days.value = chosen
  send({ weekdays: chosen })
}
</script>

<template>
  <WeekdayToggle :model-value="days" aria-label="Days" @update:model-value="chooseDays" />
  <ScheduleHours :schedule="schedule" :unsettled="unsettled" @change="send" />
  <ScheduleDates :schedule="schedule" :unsettled="unsettled" :today="today" @change="send" />
  <div class="footing">
    <p class="timezone">
      {{ timezoneLine(timezone) }}
    </p>
    <SaveState :status="save.status" :reason="save.reason" @retry="save.retry" />
  </div>
</template>

<style scoped>
@layer components {
  .footing {
    display: grid;
    justify-items: start;
    gap: var(--space-1);
  }

  .timezone {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
