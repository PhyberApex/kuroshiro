<script setup lang="ts">
import type { DeviceModelRead } from 'kuroshiro-shared'
import type { Fits } from './uploadFirmware'
import type { RadioChoice } from '@/components/RadioRow.vue'
import { useId } from 'vue'
import Checkbox from '@/components/Checkbox.vue'
import FieldError from '@/components/FieldError.vue'
import RadioRow from '@/components/RadioRow.vue'

const props = defineProps<{
  /** The Device Models a Firmware can be said to fit. */
  models: DeviceModelRead[]
  error?: string
}>()

const fits = defineModel<Fits>('fits', { required: true })
const ticked = defineModel<string[]>('ticked', { required: true })

const CHOICES: RadioChoice<Fits>[] = [
  { value: 'some', label: 'Only these Device Models', hint: 'It is offered to, and can be pushed to, Devices of these Device Models only.' },
  { value: 'all', label: 'Every Device Model', hint: 'Nothing stops it from being pushed to a Device it was not built for.' },
]

const labelId = useId()
const errorId = useId()

/** Kept in the order the Device Models are offered in, whatever the order they were ticked in. */
function tick(name: string, on: boolean) {
  ticked.value = props.models.map(model => model.name).filter(offeredName => offeredName === name ? on : ticked.value.includes(offeredName))
}
</script>

<template>
  <div class="firmware-fits">
    <p :id="labelId" class="label">
      Fits
    </p>
    <RadioRow v-model="fits" :choices="CHOICES" :aria-labelledby="labelId" :aria-describedby="error ? errorId : undefined">
      <template #under="{ choice }">
        <div v-if="choice.value === 'some' && fits === 'some'" class="models" role="group" aria-label="Device Models">
          <Checkbox
            v-for="model in models"
            :key="model.name"
            :model-value="ticked.includes(model.name)"
            :invalid="Boolean(error)"
            @update:model-value="tick(model.name, $event)"
          >
            {{ model.label }}
          </Checkbox>
        </div>
      </template>
    </RadioRow>
    <FieldError :id="errorId" :message="error" />
  </div>
</template>

<style scoped>
@layer components {
  .label {
    font-weight: var(--weight-medium);
  }

  .models {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 var(--space-4);
    padding: var(--space-1) 0 var(--space-2) calc(var(--icon) + var(--space-3));
    border-bottom: var(--rule);
  }

  @media (max-width: 820px) {
    .models {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
