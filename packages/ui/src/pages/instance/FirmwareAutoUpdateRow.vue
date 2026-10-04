<script setup lang="ts">
import { ref, watch } from 'vue'
import { updateInstanceSettings } from '@/api/instance'
import SettingRow from '@/components/SettingRow.vue'
import Switch from '@/components/Switch.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import { autoUpdateNote } from './firmwareWording'

const props = defineProps<{
  /** Whether Firmware Auto-Update is on, as the Instance Settings were loaded. The row follows its own saves from there. */
  on: boolean
  /** The newest official Firmware, which no Device is caught up to when the switch goes on. */
  newestVersion?: string
}>()

const emit = defineEmits<{
  /** The server has the new state. */
  saved: [on: boolean]
}>()

const entered = ref(props.on)

const save = useSaveAsChanged(async (on: boolean) => {
  const settings = await updateInstanceSettings({ firmwareAutoUpdate: on })
  emit('saved', settings.firmwareAutoUpdate.value)
  return settings.firmwareAutoUpdate.value
}, entered)

watch(() => props.on, (on) => {
  if (save.status !== 'saving' && save.status !== 'failed')
    entered.value = on
})

function switchTo(on: boolean) {
  entered.value = on
  save.commit()
}
</script>

<template>
  <SettingRow label="Firmware Auto-Update" :status="save.status" :reason="save.reason" @retry="save.retry">
    <template #default="{ control }">
      <Switch
        :id="control.id"
        :model-value="entered"
        :saving="save.status === 'saving'"
        :error="save.status === 'failed'"
        :aria-describedby="control['aria-describedby']"
        @update:model-value="switchTo"
      />
      <span>{{ entered ? 'On' : 'Off' }}</span>
    </template>
    <template #note>
      {{ autoUpdateNote(entered, newestVersion) }}
    </template>
  </SettingRow>
</template>
