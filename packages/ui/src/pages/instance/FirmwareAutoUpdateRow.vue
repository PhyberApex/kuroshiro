<script setup lang="ts">
import { ref, watch } from 'vue'
import { updateInstanceSettings } from '@/api/instance'
import Notice from '@/components/Notice.vue'
import ResultLine from '@/components/ResultLine.vue'
import SettingRow from '@/components/SettingRow.vue'
import Switch from '@/components/Switch.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import FirmwareCatchUp from './FirmwareCatchUp.vue'
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
  /** "Catch up now" gave Devices the current official Firmware, so the library's targets changed. */
  caughtUp: []
}>()

const entered = ref(props.on)
/** Whether the server has Auto-Update on. "Catch up now" waits for it: the server finds no one behind while it is off. */
const savedOn = ref(props.on)

/** What the last "Catch up now" came to, or why it could not start. It stays until the page is left. */
const outcome = ref<string>()
const notChecked = ref<string>()

function caughtUp(line: string) {
  notChecked.value = undefined
  outcome.value = line
  emit('caughtUp')
}

function notCheckedBecause(reason: string) {
  outcome.value = undefined
  notChecked.value = reason
}

const save = useSaveAsChanged(async (on: boolean) => {
  const settings = await updateInstanceSettings({ firmwareAutoUpdate: on })
  savedOn.value = settings.firmwareAutoUpdate.value
  emit('saved', savedOn.value)
  return savedOn.value
}, entered)

watch(() => props.on, (on) => {
  savedOn.value = on
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
      <FirmwareCatchUp v-if="entered && savedOn" @caught-up="caughtUp" @failed="notCheckedBecause" />
    </template>
    <template #note>
      {{ autoUpdateNote(entered, newestVersion) }}
    </template>
  </SettingRow>
  <Notice v-if="entered && notChecked" class="catch-up" title="Could not check which Devices are behind." :reason="notChecked" />
  <ResultLine v-if="entered && outcome" class="catch-up">
    {{ outcome }}
  </ResultLine>
</template>

<style scoped>
@layer components {
  .catch-up {
    max-width: var(--measure);
    margin-top: var(--space-3);
  }
}
</style>
