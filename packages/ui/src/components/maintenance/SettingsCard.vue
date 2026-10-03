<script setup lang="ts">
import type { InstanceSettingsResponse, SettingKey } from 'kuroshiro-shared'
import { mdiAlertCircle, mdiCheck, mdiRestore } from '@mdi/js'
import { SETTING_BOUNDS, SETTING_ENV_VARS } from 'kuroshiro-shared'
import { reactive, watch } from 'vue'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VCol, VDivider, VRow, VSwitch, VTextField } from 'vuetify/components'

const props = defineProps<{
  settings: InstanceSettingsResponse | null
  error: string | null
  saving: boolean
}>()

const emit = defineEmits<{
  save: [key: SettingKey, value: number]
  reset: [key: SettingKey]
  saveFirmwareAutoUpdate: [value: boolean]
  resetFirmwareAutoUpdate: []
}>()

const FIELDS: { key: SettingKey, label: string }[] = [
  { key: 'lowBatteryPercent', label: 'Low battery percent' },
  { key: 'offlineMultiplier', label: 'Offline multiplier' },
  { key: 'fetchFailureThreshold', label: 'Fetch failure threshold' },
]

const drafts = reactive<Record<SettingKey, string>>({
  lowBatteryPercent: '',
  offlineMultiplier: '',
  fetchFailureThreshold: '',
})

function currentDraft(key: SettingKey): string {
  const override = props.settings?.[key].override ?? null
  return override != null ? String(override) : ''
}

watch(() => props.settings, () => {
  for (const { key } of FIELDS)
    drafts[key] = currentDraft(key)
}, { immediate: true })

function isDirty(key: SettingKey): boolean {
  return drafts[key].trim() !== currentDraft(key)
}

function hint(key: SettingKey): string {
  const setting = props.settings?.[key]
  if (!setting)
    return ''
  return setting.fallbackSource === 'env'
    ? `Falls back to ${SETTING_ENV_VARS[key]} (currently ${setting.fallbackValue})`
    : `Falls back to the built-in default (${setting.fallbackValue})`
}

function save(key: SettingKey) {
  const draft = drafts[key].trim()
  if (draft === '')
    return
  const value = Number(draft)
  if (!Number.isInteger(value))
    return
  emit('save', key, value)
}

function reset(key: SettingKey) {
  emit('reset', key)
}

const firmwareAutoUpdateHint = 'Falls back to the built-in default (off)'

function toggleFirmwareAutoUpdate(value: boolean | null) {
  emit('saveFirmwareAutoUpdate', value ?? false)
}
</script>

<template>
  <VCard elevation="1" class="mb-4" data-test-id="settings-card">
    <VCardTitle>Settings</VCardTitle>
    <VDivider />
    <VCardText>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-3" :icon="mdiAlertCircle">
        {{ error }}
      </VAlert>

      <div class="text-subtitle-2 mb-1">
        Alerts
      </div>
      <p class="text-body-2 text-medium-emphasis mb-3">
        Changes apply from the next Alert Sweep, at most 5 minutes from now.
      </p>

      <VRow v-for="field in FIELDS" :key="field.key" density="comfortable" class="align-center">
        <VCol cols="12" sm="6">
          <VTextField
            v-model="drafts[field.key]"
            type="number"
            density="compact"
            :label="field.label"
            :placeholder="settings ? String(settings[field.key].fallbackValue) : ''"
            persistent-placeholder
            :hint="hint(field.key)"
            persistent-hint
            :min="SETTING_BOUNDS[field.key].min"
            :max="SETTING_BOUNDS[field.key].max"
            :data-test-id="`setting-${field.key}-input`"
          />
        </VCol>
        <VCol cols="12" sm="6" class="d-flex ga-2">
          <VBtn
            size="small"
            color="secondary"
            variant="tonal"
            :prepend-icon="mdiCheck"
            :disabled="!isDirty(field.key)"
            :loading="saving"
            :data-test-id="`setting-${field.key}-save-btn`"
            @click="save(field.key)"
          >
            Save
          </VBtn>
          <VBtn
            v-if="settings?.[field.key].override != null"
            size="small"
            variant="text"
            :prepend-icon="mdiRestore"
            :loading="saving"
            :data-test-id="`setting-${field.key}-reset-btn`"
            @click="reset(field.key)"
          >
            Reset
          </VBtn>
        </VCol>
      </VRow>

      <VDivider class="my-4" />

      <div class="text-subtitle-2 mb-1">
        Firmware
      </div>
      <p class="text-body-2 text-medium-emphasis mb-3">
        Only applies to official Firmware, and takes effect when the next official Firmware is synced.
      </p>

      <VRow density="comfortable" class="align-center">
        <VCol cols="12" sm="6">
          <VSwitch
            :model-value="settings?.firmwareAutoUpdate.value ?? false"
            label="Firmware Auto-Update"
            density="compact"
            hide-details
            :loading="saving"
            data-test-id="setting-firmwareAutoUpdate-input"
            @update:model-value="toggleFirmwareAutoUpdate"
          />
          <p class="text-caption text-medium-emphasis">
            {{ firmwareAutoUpdateHint }}
          </p>
        </VCol>
        <VCol cols="12" sm="6" class="d-flex ga-2">
          <VBtn
            v-if="settings?.firmwareAutoUpdate.override != null"
            size="small"
            variant="text"
            :prepend-icon="mdiRestore"
            :loading="saving"
            data-test-id="setting-firmwareAutoUpdate-reset-btn"
            @click="$emit('resetFirmwareAutoUpdate')"
          >
            Reset
          </VBtn>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
