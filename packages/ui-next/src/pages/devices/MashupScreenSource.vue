<script setup lang="ts">
import type { ScreenRead, UpdateMashupInput } from 'kuroshiro-shared'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { listPlugins } from '@/api/plugins'
import { updateMashup } from '@/api/screens'
import Button from '@/components/Button.vue'
import { DRAWING, drawLayout } from '@/components/layoutDrawing'
import SaveState from '@/components/SaveState.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'
import { useLoad } from '@/patterns/useLoad'
import MashupLayoutChange from './MashupLayoutChange.vue'
import { layoutChoice, MASHUP_LAYOUT_CHOICES } from './mashupLayouts'
import MashupSlots from './MashupSlots.vue'

const props = defineProps<{
  screen: ScreenRead
  /** `null` for a Mashup whose layout the server could not read. */
  mashup: ScreenRead['mashup']
  /** Reads the Screens again, after a write to this one. */
  reload: () => Promise<void>
}>()

const emit = defineEmits<{
  /** The Mashup's slots changed, so the image it has is of what it held before. */
  changed: []
}>()

const allPlugins = useLoad(listPlugins)
const opener = useTemplateRef('opener')

const layout = computed(() => props.mashup && layoutChoice(props.mashup.layout))
const savedIds = computed(() => props.mashup?.slots.map(slot => slot.pluginId) ?? [])
/** Every Plugin, or until they are loaded the ones in the slots, which the Screen names itself. */
const plugins = computed(() => allPlugins.data ?? props.mashup?.slots.map(slot => ({ id: slot.pluginId, name: slot.pluginName })) ?? [])

async function save(input: UpdateMashupInput) {
  await updateMashup(props.screen.id, input)
  emit('changed')
  await props.reload()
}

const entered = ref(savedIds.value)
const slotSave = useSaveAsChanged(pluginIds => save({ pluginIds }), entered)

watch(savedIds, (saved) => {
  if (slotSave.status !== 'saving')
    entered.value = saved
})

function changeSlot(slot: number, pluginId: string) {
  entered.value = entered.value.map((held, index) => index === slot ? pluginId : held)
  slotSave.commit()
}

const changingLayout = ref(false)

async function closeLayoutChange() {
  entered.value = savedIds.value
  changingLayout.value = false
  await nextTick()
  opener.value?.$el.focus()
}
</script>

<template>
  <div v-if="allPlugins.failure" class="change">
    <p class="unloaded">
      Could not load the Plugins. {{ allPlugins.failure.reason }}
    </p>
    <Button variant="quiet" @click="allPlugins.reload">
      Try again
    </Button>
  </div>
  <MashupLayoutChange
    v-if="changingLayout"
    :layout="mashup?.layout ?? MASHUP_LAYOUT_CHOICES[0]!.id"
    :plugin-ids="savedIds"
    :plugins="plugins"
    :save="save"
    @close="closeLayoutChange"
  />
  <template v-else>
    <template v-if="layout">
      <p class="layout">
        <svg class="drawing" :viewBox="`0 0 ${DRAWING.width} ${DRAWING.height}`" :stroke-width="DRAWING.stroke" aria-hidden="true">
          <rect v-for="(slot, index) in drawLayout(layout.id, layout.slotCount)" :key="index" v-bind="slot" />
        </svg>
        {{ layout.name }}
      </p>
      <MashupSlots :slot-names="layout.slotNames" :plugin-ids="entered" :plugins="plugins" @change="changeSlot" />
    </template>
    <p v-else class="unloaded">
      This Mashup's layout could not be read. Choose one to render it again.
    </p>
    <div class="change">
      <Button ref="opener" @click="changingLayout = true">
        Change layout
      </Button>
      <SaveState :status="slotSave.status" :reason="slotSave.reason" @retry="slotSave.retry" />
    </div>
  </template>
</template>

<style scoped>
@layer components {
  .layout {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .drawing {
    flex: none;
    width: 3.75rem;
    height: 2.25rem;
    fill: none;
    stroke: currentColor;
  }

  .unloaded {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .change {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }
}
</style>
