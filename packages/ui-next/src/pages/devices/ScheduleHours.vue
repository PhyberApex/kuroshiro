<script setup lang="ts">
import type { ScheduleInput, ScheduleRead } from 'kuroshiro-shared'
import { computed, ref, watch } from 'vue'
import Checkbox from '@/components/Checkbox.vue'
import TimeInput from '@/components/TimeInput.vue'
import { changedOfPair, crossesMidnight, DEFAULT_HOURS } from './scheduleEditing'

const props = defineProps<{
  schedule: ScheduleRead
  /** A save is under way, so what was entered is not replaced by what the server has. */
  held: boolean
}>()

const emit = defineEmits<{
  /** The hours to save: both times, the one that changed, or `null` for both. */
  change: [input: ScheduleInput]
}>()

const isAllDay = (schedule: ScheduleRead) => !(schedule.startTime && schedule.endTime)

const from = ref(props.schedule.startTime)
const to = ref(props.schedule.endTime)
const allDay = ref(isAllDay(props.schedule))

watch(() => `${props.schedule.startTime} ${props.schedule.endTime}`, () => {
  if (props.held)
    return
  from.value = props.schedule.startTime
  to.value = props.schedule.endTime
  allDay.value = isAllDay(props.schedule)
})

const crosses = computed(() => !allDay.value && crossesMidnight(from.value, to.value))

function setAllDay(checked: boolean) {
  const hours = checked ? { startTime: null, endTime: null } : DEFAULT_HOURS
  allDay.value = checked
  from.value = hours.startTime
  to.value = hours.endTime
  emit('change', hours)
}

function commit() {
  const changed = changedOfPair(props.schedule, { startTime: from.value, endTime: to.value })
  if (changed)
    emit('change', changed)
}
</script>

<template>
  <div class="schedule-hours">
    <div class="pair" role="group" aria-label="Hours">
      <template v-if="!allDay">
        <label class="end">From <TimeInput v-model="from" @commit="commit" /></label>
        <label class="end">to <TimeInput v-model="to" @commit="commit" /></label>
      </template>
      <Checkbox :model-value="allDay" @update:model-value="setAllDay">
        All day
      </Checkbox>
    </div>
    <p v-if="crosses" class="note">
      This window crosses midnight.
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .schedule-hours {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .pair {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .end {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .note {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
