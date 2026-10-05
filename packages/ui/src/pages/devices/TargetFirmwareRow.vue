<script setup lang="ts">
import type { DeviceDetail, FirmwareRead } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import Button from '@/components/Button.vue'
import ResultLine from '@/components/ResultLine.vue'
import Select from '@/components/Select.vue'
import SettingRow from '@/components/SettingRow.vue'
import { useNow } from '@/patterns/useNow'
import { nextPollTime } from './currentScreenStory'
import { firmwareOptions, NO_TARGET } from './deviceSettings'
import { useDeviceSetting, useDeviceWrite } from './useDeviceSetting'

const props = defineProps<{
  device: DeviceDetail
  firmware: FirmwareRead[]
}>()

const now = useNow()

const savedTarget = () => props.device.targetFirmware?.id ?? NO_TARGET
const pushPending = computed(() => props.device.pending.firmwarePush)

const target = useDeviceSetting(savedTarget, chosen =>
  chosen === savedTarget() ? undefined : { targetFirmwareId: chosen === NO_TARGET ? null : chosen })

const push = useDeviceWrite()

/** "Update now" and "Cancel push" share one write; its loading mark stands on the button that sent it. */
const sentBy = ref<'update' | 'cancel'>('update')

function sendPush(updateFirmware: boolean) {
  sentBy.value = updateFirmware ? 'update' : 'cancel'
  push.send({ updateFirmware })
}

/** The row has one save state: the push's while it has something to say, the target's otherwise. */
const saveState = computed(() => push.status === 'idle' ? target : push)

const options = computed(() => firmwareOptions(props.firmware, {
  deviceModel: props.device.deviceModel?.name ?? null,
  target: props.device.targetFirmware,
  pushPending: pushPending.value,
}))

const goesOut = computed(() => {
  const around = nextPollTime(props.device, now.value)
  return around ? `Goes out at the next poll, around ${around}` : 'Goes out at the next poll'
})
</script>

<template>
  <SettingRow label="Target Firmware" :status="saveState.status" :reason="saveState.reason" @retry="saveState.retry">
    <template #default="{ control }">
      <Select v-bind="control" class="target" :model-value="target.entered" :options="options" @update:model-value="target.choose($event ?? NO_TARGET)" />
      <Button :disabled="pushPending || !device.targetFirmware || target.saving" :loading="push.status === 'saving' && sentBy === 'update'" @click="sendPush(true)">
        Update now
      </Button>
      <Button v-if="pushPending" :loading="push.status === 'saving' && sentBy === 'cancel'" @click="sendPush(false)">
        Cancel push
      </Button>
      <ResultLine class="pending" :running="pushPending">
        <template v-if="pushPending" #default>
          {{ goesOut }}
        </template>
      </ResultLine>
    </template>
    <template v-if="device.deviceModel" #note>
      Only Firmware that fits {{ device.deviceModel.label }} is listed.
    </template>
  </SettingRow>
</template>

<style scoped>
@layer components {
  :deep(.target) {
    min-width: min(20rem, 100%);
  }
}
</style>
