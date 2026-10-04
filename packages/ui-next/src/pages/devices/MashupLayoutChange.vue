<script setup lang="ts">
import type { MashupLayout, UpdateMashupInput } from 'kuroshiro-shared'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import FieldError from '@/components/FieldError.vue'
import LayoutPicker from '@/components/LayoutPicker.vue'
import InPlaceForm from './InPlaceForm.vue'
import { carriedOver, layoutChoice, MASHUP_LAYOUT_CHOICES, placedIn, withoutSlot } from './mashupLayouts'
import MashupSlots from './MashupSlots.vue'
import { noSlotLine } from './screenSourceWording'

const props = defineProps<{
  /** The Mashup's layout as it is saved. */
  layout: MashupLayout
  /** The Plugins in its slots as they are saved, in slot order. */
  pluginIds: string[]
  plugins: { id: string, name: string }[]
  /** Saves the layout with its whole slot list. */
  save: (input: Required<UpdateMashupInput>) => Promise<void>
}>()

const emit = defineEmits<{
  /** The form is done with: the layout was saved, or the change was cancelled. */
  close: []
}>()

const form = useTemplateRef('form')

const layout = ref<MashupLayout>(props.layout)
/** Every Plugin the admin has placed, in slot order, those the chosen layout has no slot for included: going back to a larger layout brings them back. */
const placed = ref<(string | null)[]>([...props.pluginIds])
const saving = ref(false)
const problem = ref<string>()

const chosen = computed(() => layoutChoice(layout.value))
const inSlots = computed(() => carriedOver(placed.value, layout.value))
const isFilled = computed(() => inSlots.value.every(pluginId => pluginId !== null))
const withoutSlotLine = computed(() => {
  const names = withoutSlot(placed.value, layout.value).flatMap(id => props.plugins.find(plugin => plugin.id === id)?.name ?? [])
  return names.length > 0 ? noSlotLine(names) : undefined
})

function place(slot: number, pluginId: string) {
  placed.value = placedIn(placed.value, slot, pluginId)
}

async function saveLayout() {
  saving.value = true
  problem.value = undefined
  try {
    await props.save({ layout: layout.value, pluginIds: inSlots.value.flatMap(pluginId => pluginId ?? []) })
    emit('close')
  }
  catch (error) {
    problem.value = failureReason(error) ?? 'The layout could not be saved.'
  }
  finally {
    saving.value = false
  }
}

onMounted(() => (form.value?.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus())
</script>

<template>
  <InPlaceForm ref="form" title="Change layout">
    <LayoutPicker :model-value="layout" :layouts="MASHUP_LAYOUT_CHOICES" aria-label="Layout" @update:model-value="id => layout = id as MashupLayout" />
    <MashupSlots :slot-names="chosen.slotNames" :plugin-ids="inSlots" :plugins="plugins" @change="place" />
    <p v-if="withoutSlotLine" class="note">
      {{ withoutSlotLine }}
    </p>
    <FieldError :message="problem" />
    <template #buttons>
      <Button variant="primary" :disabled="!isFilled" :loading="saving" @click="saveLayout">
        Save layout
      </Button>
      <Button variant="quiet" :disabled="saving" @click="$emit('close')">
        Cancel
      </Button>
    </template>
  </InPlaceForm>
</template>

<style scoped>
@layer components {
  .note {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
