<script setup lang="ts">
import type { ScheduleInput, ScheduleRead } from 'kuroshiro-shared'
import { computed, ref, useId, watch } from 'vue'
import Checkbox from '@/components/Checkbox.vue'
import DateInput from '@/components/DateInput.vue'
import FieldError from '@/components/FieldError.vue'
import { changedOfPair, dateRangeProblem, weekFrom } from './scheduleEditing'

const props = defineProps<{
  schedule: ScheduleRead
  /** A save is under way, so what was entered is not replaced by what the server has. */
  held: boolean
  /** The day it is on the server, `YYYY-MM-DD`. */
  today: string
}>()

const emit = defineEmits<{
  /** The dates to save: both days, the one that changed, or `null` for both. */
  change: [input: ScheduleInput]
}>()

const isRanged = (schedule: ScheduleRead) => !!(schedule.startDate && schedule.endDate)

const firstDay = ref(props.schedule.startDate)
const lastDay = ref(props.schedule.endDate)
const ranged = ref(isRanged(props.schedule))

watch(() => `${props.schedule.startDate} ${props.schedule.endDate}`, () => {
  if (props.held)
    return
  firstDay.value = props.schedule.startDate
  lastDay.value = props.schedule.endDate
  ranged.value = isRanged(props.schedule)
})

const problemId = useId()
const problem = computed(() => ranged.value ? dateRangeProblem(firstDay.value, lastDay.value) : undefined)
const hasPassed = computed(() => !!lastDay.value && lastDay.value < props.today)

function setRanged(checked: boolean) {
  const days = checked ? { startDate: props.today, endDate: weekFrom(props.today) } : { startDate: null, endDate: null }
  ranged.value = checked
  firstDay.value = days.startDate
  lastDay.value = days.endDate
  emit('change', days)
}

function commit() {
  const changed = !problem.value && changedOfPair(props.schedule, { startDate: firstDay.value, endDate: lastDay.value })
  if (changed)
    emit('change', changed)
}
</script>

<template>
  <div class="schedule-dates">
    <Checkbox :model-value="ranged" @update:model-value="setRanged">
      Only between two dates
    </Checkbox>
    <div v-if="ranged" class="pair" role="group" aria-label="Dates">
      <label class="end">From <DateInput v-model="firstDay" :invalid="!!problem" :aria-describedby="problem ? problemId : undefined" @commit="commit" /></label>
      <label class="end">to <DateInput v-model="lastDay" @commit="commit" /></label>
    </div>
    <FieldError :id="problemId" :message="problem" />
    <p v-if="ranged && !problem" class="note">
      <span>Both days count.</span>{{ ' ' }}<span v-if="hasPassed">The last day has passed, so this Screen no longer shows.</span>
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .schedule-dates {
    display: grid;
    justify-items: start;
    min-width: 0;
  }

  .pair {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-top: var(--space-1);
  }

  .end {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .note {
    margin-top: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
