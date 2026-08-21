<script setup lang="ts">
import type { ScheduleInput, Screen } from '@/types'
import { mdiCheck, mdiDelete } from '@mdi/js'
import { computed, ref, watch } from 'vue'
import { VAlert, VBtn, VBtnToggle, VCard, VCardActions, VCardText, VCardTitle, VDialog, VDivider, VSpacer, VSwitch, VTextField } from 'vuetify/components'
import { useScheduleStore } from '@/stores/schedule'
import { useScreensStore } from '@/stores/screens'
import { WEEKDAY_LABELS, withoutSeconds } from '@/utils/scheduleSummary'

const props = defineProps<{
  modelValue: boolean
  deviceId: string
  screen: Screen
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const scheduleStore = useScheduleStore()
const screensStore = useScreensStore()

const enabled = ref(true)
const weekdays = ref<number[]>([])
const startTime = ref('')
const endTime = ref('')
const startDate = ref('')
const endDate = ref('')
const error = ref<string | null>(null)
const saving = ref(false)

const hasSchedule = computed(() => Boolean(props.screen.schedule))
const spansMidnight = computed(() => Boolean(startTime.value && endTime.value && startTime.value > endTime.value))

watch(() => props.modelValue, (open) => {
  if (!open)
    return
  const schedule = props.screen.schedule
  enabled.value = schedule?.enabled ?? true
  weekdays.value = schedule?.weekdays ? [...schedule.weekdays] : []
  startTime.value = schedule?.startTime ? withoutSeconds(schedule.startTime) : ''
  endTime.value = schedule?.endTime ? withoutSeconds(schedule.endTime) : ''
  startDate.value = schedule?.startDate ?? ''
  endDate.value = schedule?.endDate ?? ''
  error.value = null
}, { immediate: true })

function validationError(): string | null {
  if (Boolean(startTime.value) !== Boolean(endTime.value))
    return 'Set both a start and an end time, or neither.'
  if (Boolean(startDate.value) !== Boolean(endDate.value))
    return 'Set both a start and an end date, or neither.'
  if (startDate.value && endDate.value && startDate.value > endDate.value)
    return 'The start date must not be after the end date.'
  return null
}

function scheduleInput(): ScheduleInput {
  const hasWindow = Boolean(startTime.value && endTime.value)
  const hasRange = Boolean(startDate.value && endDate.value)
  return {
    enabled: enabled.value,
    weekdays: weekdays.value.length ? [...weekdays.value].sort((a, b) => a - b) : null,
    startTime: hasWindow ? startTime.value : null,
    endTime: hasWindow ? endTime.value : null,
    startDate: hasRange ? startDate.value : null,
    endDate: hasRange ? endDate.value : null,
  }
}

async function withScreensRefresh(action: () => Promise<unknown>) {
  saving.value = true
  error.value = null
  try {
    await action()
    await screensStore.fetchScreensForDevice(props.deviceId)
    close()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Something went wrong.'
  }
  finally {
    saving.value = false
  }
}

async function save() {
  const invalid = validationError()
  if (invalid) {
    error.value = invalid
    return
  }
  const input = scheduleInput()
  await withScreensRefresh(() => hasSchedule.value
    ? scheduleStore.update(props.screen.id, input)
    : scheduleStore.create(props.screen.id, input))
}

async function removeSchedule() {
  await withScreensRefresh(() => scheduleStore.remove(props.screen.id))
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <VDialog :model-value="modelValue" max-width="640" @update:model-value="emit('update:modelValue', $event)">
    <VCard data-test-id="schedule-dialog">
      <VCardTitle>Schedule for "{{ screen.plugin ? screen.plugin.name : screen.filename }}"</VCardTitle>
      <VDivider />
      <VCardText>
        <VAlert type="info" variant="tonal" density="compact" class="mb-4 text-body-2">
          A screen only joins the rotation while its schedule matches. Leave a section empty to put no
          restriction on it. Times and dates are evaluated in the server's timezone.
        </VAlert>

        <VAlert v-if="error" type="error" variant="tonal" class="mb-4" data-test-id="schedule-error">
          {{ error }}
        </VAlert>

        <VSwitch
          v-model="enabled"
          color="primary"
          label="Enabled"
          hide-details
          class="mb-2"
          data-test-id="schedule-enabled-switch"
        />
        <p class="text-caption text-medium-emphasis mb-4">
          Disable to pause the screen without losing the rules below.
        </p>

        <div class="text-subtitle-2 mb-1">
          Weekdays
        </div>
        <p class="text-caption text-medium-emphasis mb-2">
          Select none for every day.
        </p>
        <VBtnToggle v-model="weekdays" multiple variant="outlined" divided class="mb-6 flex-wrap" data-test-id="schedule-weekdays">
          <VBtn v-for="(label, day) in WEEKDAY_LABELS" :key="label" :value="day" size="small" :data-test-id="`schedule-weekday-${day}`">
            {{ label }}
          </VBtn>
        </VBtnToggle>

        <div class="text-subtitle-2 mb-2">
          Daily time window
        </div>
        <div class="d-flex ga-4 flex-wrap">
          <VTextField v-model="startTime" type="time" label="From" density="comfortable" style="min-width: 150px" data-test-id="schedule-start-time" />
          <VTextField v-model="endTime" type="time" label="To" density="comfortable" style="min-width: 150px" data-test-id="schedule-end-time" />
        </div>
        <p v-if="spansMidnight" class="text-caption text-medium-emphasis mb-6" data-test-id="schedule-midnight-hint">
          This window crosses midnight.
        </p>

        <div class="text-subtitle-2 mb-2 mt-2">
          Active date range
        </div>
        <div class="d-flex ga-4 flex-wrap">
          <VTextField v-model="startDate" type="date" label="From" density="comfortable" style="min-width: 180px" data-test-id="schedule-start-date" />
          <VTextField v-model="endDate" type="date" label="To" density="comfortable" style="min-width: 180px" data-test-id="schedule-end-date" />
        </div>
      </VCardText>
      <VDivider />
      <VCardActions>
        <VBtn
          v-if="hasSchedule"
          color="error"
          variant="text"
          :prepend-icon="mdiDelete"
          :disabled="saving"
          data-test-id="schedule-remove-btn"
          @click="removeSchedule"
        >
          Remove schedule
        </VBtn>
        <VSpacer />
        <VBtn variant="text" :disabled="saving" @click="close">
          Cancel
        </VBtn>
        <VBtn
          color="primary"
          variant="tonal"
          :prepend-icon="mdiCheck"
          :loading="saving"
          data-test-id="schedule-save-btn"
          @click="save"
        >
          Save
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
