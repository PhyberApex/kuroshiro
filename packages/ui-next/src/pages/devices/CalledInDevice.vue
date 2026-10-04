<script setup lang="ts">
import type { DeviceSummary } from 'kuroshiro-shared'
import { computed, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
import { imageUrl } from '@/api/client'
import { updateDevice } from '@/api/devices'
import Button from '@/components/Button.vue'
import FieldError from '@/components/FieldError.vue'
import Plate from '@/components/Plate.vue'
import SaveState from '@/components/SaveState.vue'
import TextInput from '@/components/TextInput.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import { useDevices } from '@/reads/sharedReads'
import { devicePath } from './devicePaths'

const props = defineProps<{
  device: DeviceSummary
}>()

const devices = useDevices()
const nameId = useId()
const errorId = `${nameId}-error`

const name = ref(props.device.name)
const error = ref<string>()

const identity = computed(() => [
  props.device.friendlyId,
  props.device.firmwareVersion && `Firmware ${props.device.firmwareVersion}`,
  props.device.deviceModel?.label,
].filter(Boolean).join(' · '))

// The answer's body is not read: the Devices are asked for again, and the name comes back with them.
const nameSave = useSaveAsChanged(async (entered: string) => {
  await updateDevice(props.device.id, { name: entered })
  void devices.reload()
  return entered
}, name)

function saveName() {
  name.value = name.value.trim()
  error.value = name.value ? undefined : 'A Device needs a name.'
  if (!error.value)
    nameSave.commit()
}
</script>

<template>
  <section class="called-in" :aria-labelledby="`${nameId}-label`">
    <Plate
      size="list"
      :name="`What ${device.name} shows`"
      :src="imageUrl(device.currentScreen.imagePath)"
      :width="device.deviceModel?.width"
      :height="device.deviceModel?.height"
    />
    <div class="said">
      <h2 :id="`${nameId}-label`" class="label">
        A Device called in
      </h2>
      <p class="identity">
        {{ identity }}
      </p>
      <div class="naming">
        <label class="name-label" :for="nameId">Name</label>
        <TextInput
          :id="nameId"
          v-model="name"
          prose
          :invalid="Boolean(error)"
          :aria-describedby="error ? errorId : undefined"
          @commit="saveName"
        >
          <template #status>
            <SaveState :status="nameSave.status" :reason="nameSave.reason" @retry="nameSave.retry" />
          </template>
        </TextInput>
        <Button as-child variant="primary">
          <RouterLink :to="devicePath(device.id)">
            Open {{ device.name }}
          </RouterLink>
        </Button>
      </div>
      <FieldError :id="errorId" :message="error" />
    </div>
  </section>
</template>

<style scoped>
@layer components {
  .called-in {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-5);
    max-width: 45rem;
    padding: var(--space-4) 0;
    border-top: var(--rule-heavy);
    border-bottom: var(--rule);
  }

  .called-in + .called-in {
    border-top: 0;
  }

  .label {
    font-size: inherit;
    font-weight: var(--weight-semibold);
  }

  .identity {
    margin-top: var(--space-1);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .naming {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-top: var(--space-3);
  }

  .name-label {
    font-weight: var(--weight-medium);
  }

  @media (max-width: 820px) {
    .called-in {
      align-items: start;
      gap: var(--space-3);
    }
  }
}
</style>
