<script setup lang="ts">
import type { DeviceDetail } from 'kuroshiro-shared'
import type { SaveStatus } from '@/components/useSaveAsChanged'
import { computed, ref, watch } from 'vue'
import Button from '@/components/Button.vue'
import SecretField from '@/components/SecretField.vue'
import SettingRow from '@/components/SettingRow.vue'
import Switch from '@/components/Switch.vue'
import TextInput from '@/components/TextInput.vue'
import PageSection from '@/patterns/PageSection.vue'
import { asStoredMac, isMacAddress, MIRROR_MAC_MESSAGE, mirroringInput, SETTINGS_SECTIONS } from './deviceSettings'
import { possessive } from './screenNaming'
import { useDeviceWrite } from './useDeviceSetting'

type Row = 'switch' | 'mac' | 'key'

const props = defineProps<{
  device: DeviceDetail
}>()

const saved = computed(() => props.device.mirror)

const on = ref(saved.value.enabled)
const mac = ref(saved.value.mac ?? '')
const key = ref('')
const macProblem = ref<string>()

/** The three rows are one setting on the server, so they share one write; its state stands on the row that sent it. */
const write = useDeviceWrite()
const sentBy = ref<Row>('switch')
// Enter and the blur that follows it are one entry of the key, not two.
let keyOffered = ''
let keySent: string | undefined

watch(() => saved.value.enabled, (enabled) => {
  if (!write.unsettled)
    on.value = enabled
})
watch(() => saved.value.mac, (stored) => {
  if (!write.unsettled)
    mac.value = stored ?? ''
})
// The server has the key: the field goes back to saying only that one is stored.
watch(() => write.status, (status) => {
  if (status !== 'saved' || key.value !== keySent)
    return
  key.value = ''
  keyOffered = ''
})

function save(row: Row) {
  const input = mirroringInput({ on: on.value, mac: mac.value, key: key.value }, saved.value)
  if (!input)
    return
  sentBy.value = row
  keySent = input.mirrorApikey
  write.send(input)
}

function stateOf(row: Row): { status: SaveStatus, reason?: string } {
  return sentBy.value === row ? { status: write.status, reason: write.reason } : { status: 'idle' }
}

function switchTo(next: boolean) {
  on.value = next
  save('switch')
}

function saveMac() {
  macProblem.value = isMacAddress(mac.value) ? undefined : MIRROR_MAC_MESSAGE
  if (macProblem.value)
    return
  mac.value = asStoredMac(mac.value)
  save('mac')
}

function useOwn() {
  mac.value = props.device.mac
  saveMac()
}

function saveKey() {
  if (!key.value || key.value === keyOffered)
    return
  keyOffered = key.value
  save('key')
}

const isOwn = computed(() => asStoredMac(mac.value) === asStoredMac(props.device.mac))
const notOnYet = computed(() => on.value && !saved.value.enabled && write.status !== 'saving')
</script>

<template>
  <PageSection :id="SETTINGS_SECTIONS.mirroring" title="Mirroring" rows>
    <SettingRow label="Mirroring" v-bind="stateOf('switch')" @retry="write.retry">
      <template #default="{ control }">
        <Switch
          :id="control.id"
          :model-value="on"
          :saving="stateOf('switch').status === 'saving'"
          :error="stateOf('switch').status === 'failed'"
          :aria-describedby="control['aria-describedby']"
          @update:model-value="switchTo"
        />
        <span>{{ on ? 'On' : 'Off' }}</span>
      </template>
      <template v-if="notOnYet" #note>
        Not on yet. Enter the mirror MAC address and API key.
      </template>
    </SettingRow>
    <template v-if="on">
      <SettingRow label="Mirror MAC address" v-bind="stateOf('mac')" :error="macProblem" @retry="write.retry">
        <template #default="{ control }">
          <TextInput v-model="mac" v-bind="control" class="mac" placeholder="A4:CF:12:00:00:00" autocomplete="off" spellcheck="false" @commit="saveMac" />
          <Button v-if="!isOwn" variant="quiet" @click="useOwn">
            Use {{ possessive(device.name) }} own
          </Button>
        </template>
        <template #note>
          <template v-if="isOwn">
            This is {{ possessive(device.name) }} own MAC address, which makes it a Proxied Device: its whole poll is forwarded and TRMNL answers it.
          </template>
          <template v-else>
            The MAC address of the Device on TRMNL's server whose image is shown.
          </template>
        </template>
      </SettingRow>
      <SettingRow label="Mirror API key" v-bind="stateOf('key')" @retry="write.retry">
        <template #default="{ control }">
          <SecretField
            v-model="key"
            v-bind="control"
            class="key"
            :stored="saved.apikeySet"
            replace-label="Replace mirror API key"
            @blur="saveKey"
            @keydown.enter="saveKey"
          />
        </template>
        <template #note>
          That Device's API key on TRMNL.
        </template>
      </SettingRow>
    </template>
    <template #under>
      {{ device.name }} shows the image of a Device on TRMNL's own server instead of its own Screens. While it is on, Rotation, Sleep Mode and Firmware pushes do not apply to {{ device.name }}; its Screens are kept.
    </template>
  </PageSection>
</template>

<style scoped>
@layer components {
  :deep(.mac) {
    width: 12.5rem;
    max-width: 100%;
  }

  :deep(.key) {
    width: 16rem;
    max-width: 100%;
  }
}
</style>
