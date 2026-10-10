<script setup lang="ts">
import type { DeviceDetail, MashupLayout } from 'kuroshiro-shared'
import { computed, ref, useId, watch } from 'vue'
import { listPlugins } from '@/api/plugins'
import { createMashup } from '@/api/screens'
import LayoutPicker from '@/components/LayoutPicker.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import { useReportScreenFormChanged } from './addScreenChanged'
import AddScreenFoot from './AddScreenFoot.vue'
import { useAddScreen } from './addScreenForm'
import { carriedOver, layoutChoice, MASHUP_LAYOUT_CHOICES, placedIn } from './mashupLayouts'
import MashupSlots from './MashupSlots.vue'
import ScreenNameField from './ScreenNameField.vue'
import { screenNameProblem } from './screenNaming'

const props = defineProps<{
  device: DeviceDetail
}>()

const FIRST_LAYOUT = MASHUP_LAYOUT_CHOICES[0]!.id

const plugins = useLoad(listPlugins)
const addition = useAddScreen()

const layoutLabelId = useId()
const slotsLabelId = useId()

const name = ref('')
const nameProblem = ref<string>()
const layout = ref<MashupLayout>(FIRST_LAYOUT)
/** Every Plugin the admin has placed, in slot order, those the chosen layout has no slot for included: going back to a larger layout brings them back. */
const placed = ref<(string | null)[]>([])

const inSlots = computed(() => carriedOver(placed.value, layout.value))
const isFilled = computed(() => name.value.trim() !== '' && inSlots.value.every(pluginId => pluginId !== null))
const changed = computed(() => !addition.added && (name.value.trim() !== '' || layout.value !== FIRST_LAYOUT || placed.value.some(Boolean)))
useReportScreenFormChanged(changed)

// The button is disabled without a name, so a name that was entered and cleared again is said to be missing as it is cleared.
watch(name, () => (nameProblem.value = screenNameProblem(name.value)))

function add() {
  if (!isFilled.value)
    return
  void addition.create(() => createMashup({
    deviceId: props.device.id,
    name: name.value.trim(),
    layout: layout.value,
    pluginIds: inSlots.value.flatMap(pluginId => pluginId ?? []),
  }))
}
</script>

<template>
  <LoadBody v-slot="{ data }" :load="plugins" loading="Loading the Plugins" failed="Could not load the Plugins.">
    <form class="add-mashup-screen" novalidate @submit.prevent="add">
      <ScreenNameField v-model="name" :error="nameProblem" />
      <div>
        <p :id="layoutLabelId" class="label">
          Layout
        </p>
        <LayoutPicker :model-value="layout" :layouts="MASHUP_LAYOUT_CHOICES" :aria-labelledby="layoutLabelId" @update:model-value="id => layout = id as MashupLayout" />
      </div>
      <div role="group" :aria-labelledby="slotsLabelId">
        <p :id="slotsLabelId" class="label">
          Plugins
        </p>
        <MashupSlots :slot-names="layoutChoice(layout).slotNames" :plugin-ids="inSlots" :plugins="data" @change="(slot, pluginId) => placed = placedIn(placed, slot, pluginId)" />
        <p class="hint">
          Any Plugin can fill a slot, whether or not it is assigned to {{ device.name }}. A Plugin fills one slot at most.
        </p>
      </div>
      <AddScreenFoot :running="addition.running" :disabled="!isFilled" :changed="changed" :failure="addition.failure" :guarded="false" />
    </form>
  </LoadBody>
</template>

<style scoped>
@layer components {
  .add-mashup-screen {
    display: grid;
    gap: var(--space-4);
  }

  .label {
    padding-bottom: var(--space-1);
    font-weight: var(--weight-medium);
  }

  .hint {
    padding-top: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
