<script setup lang="ts">
import type { DeviceDetail, DeviceModelRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'
import SettingRow from '@/components/SettingRow.vue'
import { reportsAnotherSize } from './deviceFacts'
import { useDeviceSetting } from './deviceSetting'
import { deviceModelOptions } from './deviceSettings'

const props = defineProps<{
  device: DeviceDetail
  models: DeviceModelRead[]
}>()

const assigned = computed(() => props.device.deviceModel)

const model = useDeviceSetting(() => assigned.value?.name ?? null, chosen =>
  chosen && chosen !== assigned.value?.name ? { deviceModelName: chosen } : undefined)

function choose(chosen: string | null) {
  model.entered = chosen
  model.commit()
}

const options = computed(() => deviceModelOptions(props.models, assigned.value?.name ?? null))

/** The Device says which model it is by its name on the wire; the Instance may know that name's label. */
const reported = computed(() => {
  const name = props.device.reported.model
  return name && (props.models.find(known => known.name === name)?.label ?? name)
})
</script>

<template>
  <SettingRow label="Device Model" :status="model.status" :reason="model.reason" @retry="model.retry">
    <template #default="{ control }">
      <Select
        v-bind="control"
        class="device-model"
        :model-value="model.entered"
        :options="options"
        placeholder="Choose a Device Model"
        @update:model-value="choose"
      />
    </template>
    <template v-if="reported" #source>
      {{ device.name }} reports {{ reported }}
    </template>
    <template v-if="!assigned || assigned.deprecated || reportsAnotherSize(device)" #note>
      <span v-if="reportsAnotherSize(device)" class="problem">
        <Icon name="problem" class="mark" />
        <span>{{ device.name }} reports {{ device.reported.width }} × {{ device.reported.height }}, which is not this Device Model's size. Images are rendered for the Device Model chosen here.</span>
      </span>
      <span v-if="assigned?.deprecated" class="line">TRMNL no longer lists this Device Model.</span>
      <span v-if="!assigned" class="line">Not resolved yet. Images are rendered for TRMNL OG.</span>
    </template>
  </SettingRow>
</template>

<style scoped>
@layer components {
  :deep(.device-model) {
    min-width: min(20rem, 100%);
  }

  .line {
    display: block;
  }

  /* A problem is ink, never red: it is told by the icon. */
  .problem {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    color: var(--color-ink);
  }

  .mark {
    flex: none;
    margin-top: 0.2em;
  }
}
</style>
