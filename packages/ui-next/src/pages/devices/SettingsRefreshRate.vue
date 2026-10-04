<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { RateUnit } from './deviceSettings'
import { computed, ref } from 'vue'
import NumberInput from '@/components/NumberInput.vue'
import Select from '@/components/Select.vue'
import SettingRow from '@/components/SettingRow.vue'
import ReadRow from '@/patterns/ReadRow.vue'
import { RATE_RANGE_MESSAGE, RATE_UNIT_OPTIONS, rateSeconds, rateShown } from './deviceSettings'
import { useDeviceSetting } from './useDeviceSetting'

const props = defineProps<{
  device: DeviceDetail
}>()

const rate = useDeviceSetting(() => rateShown(props.device.refreshRate), (entered) => {
  const seconds = rateSeconds(entered)
  return seconds === undefined || seconds === props.device.refreshRate ? undefined : { refreshRate: seconds }
})

const leftOutOfRange = ref(false)
const rangeMessage = computed(() => leftOutOfRange.value && rateSeconds(rate.entered) === undefined ? RATE_RANGE_MESSAGE : undefined)

function save() {
  leftOutOfRange.value = rateSeconds(rate.entered) === undefined
  rate.commit()
}

function chooseUnit(unit: RateUnit | null) {
  rate.entered.unit = unit ?? 'minutes'
  save()
}
</script>

<template>
  <ReadRow v-if="device.isProxied" label="Refresh rate">
    Set by TRMNL
    <template #note>
      {{ device.name }} is a Proxied Device, so TRMNL's answer decides how often it polls.
    </template>
  </ReadRow>
  <SettingRow v-else label="Refresh rate" :status="rate.status" :reason="rate.reason" :error="rangeMessage" @retry="rate.retry">
    <template #default="{ control }">
      every
      <NumberInput v-model="rate.entered.amount" v-bind="control" class="amount" inputmode="decimal" min="1" @commit="save" />
      <Select
        class="unit"
        aria-label="Refresh rate unit"
        :model-value="rate.entered.unit"
        :options="RATE_UNIT_OPTIONS"
        @update:model-value="chooseUnit"
      />
    </template>
    <template #note>
      How often {{ device.name }} polls, and so how often Rotation moves on. It also sets when {{ device.name }} counts as offline.
    </template>
  </SettingRow>
</template>

<style scoped>
@layer components {
  :deep(.amount) {
    width: 4.5rem;
  }

  :deep(.unit) {
    min-width: 7rem;
  }
}
</style>
