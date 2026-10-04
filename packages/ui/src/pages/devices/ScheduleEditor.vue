<script setup lang="ts">
import type { ScreenRead } from 'kuroshiro-shared'
import { nextTick, ref, useId, useTemplateRef } from 'vue'
import { createSchedule } from '@/api/screens'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import FieldError from '@/components/FieldError.vue'
import ScheduleControls from './ScheduleControls.vue'
import { EVERY_DAY_ALL_DAY } from './scheduleEditing'
import ScheduleRemoval from './ScheduleRemoval.vue'
import ScheduleSwitch from './ScheduleSwitch.vue'

const props = defineProps<{
  /** The Screen, under the name the admin reads it by. */
  screen: ScreenRead
  /** Reads the Screens again, after a write to this one. */
  reload: () => Promise<void>
}>()

const headingId = useId()
const editor = useTemplateRef('editor')
const adding = ref(false)
const addProblem = ref<string>()

/** Adding and removing a Schedule both take away the button that had the focus. */
async function focusOn(selector: string) {
  await nextTick()
  editor.value?.querySelector<HTMLElement>(selector)?.focus()
}

async function add() {
  adding.value = true
  addProblem.value = undefined
  try {
    await createSchedule(props.screen.id, EVERY_DAY_ALL_DAY)
    await props.reload()
    await focusOn('[role="switch"]')
  }
  catch (error) {
    addProblem.value = failureReason(error) ?? 'That did not work.'
  }
  finally {
    adding.value = false
  }
}

async function showWithoutSchedule() {
  await props.reload()
  await focusOn('button')
}
</script>

<template>
  <div ref="editor" class="schedule-editor" role="group" :aria-labelledby="headingId">
    <div class="heading-line">
      <h4 class="heading">
        <span :id="headingId">Schedule</span>
        <span v-if="screen.schedule" class="standing">{{ screen.schedule.enabled ? 'on' : 'off, days and hours kept' }}</span>
      </h4>
      <ScheduleSwitch v-if="screen.schedule" :screen-id="screen.id" :enabled="screen.schedule.enabled" label="Schedule" :reload="reload" trailing />
    </div>
    <template v-if="screen.schedule">
      <ScheduleControls :screen-id="screen.id" :schedule="screen.schedule" :reload="reload" />
      <div>
        <ScheduleRemoval :screen-id="screen.id" :screen-name="screen.name" @removed="showWithoutSchedule" />
      </div>
    </template>
    <template v-else>
      <p class="always">
        Always shown. A Schedule limits this Screen to certain days and hours.
      </p>
      <div>
        <Button :loading="adding" @click="add">
          Add a Schedule
        </Button>
      </div>
      <FieldError :message="addProblem" />
    </template>
  </div>
</template>

<style scoped>
@layer components {
  .schedule-editor {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .heading-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0 var(--space-3);
  }

  /* The heading gives way before the switch does: "off, days and hours kept" goes under "Schedule" in a narrow column. */
  .heading {
    display: flex;
    flex: 1 1 0;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-2);
    min-width: 6rem;
    margin: 0;
    font-weight: var(--weight-semibold);
    font-size: var(--text-md);
  }

  .standing,
  .always {
    color: var(--color-ink-soft);
  }

  .standing {
    font-weight: var(--weight-regular);
    font-size: var(--text-sm);
  }
}
</style>
