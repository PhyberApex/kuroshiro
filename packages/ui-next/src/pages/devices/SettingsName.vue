<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import { ref } from 'vue'
import SettingRow from '@/components/SettingRow.vue'
import TextInput from '@/components/TextInput.vue'
import { deviceNameProblem } from './deviceNaming'
import { useDeviceSetting } from './deviceSetting'

const props = defineProps<{
  device: DeviceDetail
}>()

const problem = ref<string>()

const name = useDeviceSetting(() => props.device.name, entered =>
  entered.trim() === props.device.name ? undefined : { name: entered.trim() })

function save() {
  problem.value = deviceNameProblem(name.entered)
  if (!problem.value)
    name.commit()
}
</script>

<template>
  <SettingRow v-slot="{ control }" label="Name" :status="name.status" :reason="name.reason" :error="problem" @retry="name.retry">
    <TextInput v-model="name.entered" v-bind="control" class="name" prose autocomplete="off" @commit="save" />
  </SettingRow>
</template>

<style scoped>
@layer components {
  :deep(.name) {
    width: 16rem;
    max-width: 100%;
  }
}
</style>
