<script setup lang="ts">
import type { DeviceModelRead, PaletteRead } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { deletePalette } from '@/api/device-models'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { deletionWording } from './paletteForm'

const props = defineProps<{
  palette: PaletteRead
  /** The Device Models, which name the Palette each Device goes back to. */
  models: DeviceModelRead[]
  palettes: PaletteRead[]
}>()

defineEmits<{
  deleted: []
}>()

const asking = ref(false)
const wording = computed(() => deletionWording(props.palette, props.models, props.palettes))
</script>

<template>
  <Button :aria-label="`Delete ${palette.name}`" @click="asking = true">
    Delete
  </Button>
  <Confirmation
    v-model:open="asking"
    :title="wording.title"
    confirm-label="Delete Palette"
    :action="() => deletePalette(palette.id)"
    @confirmed="$emit('deleted')"
  >
    <template #lost>
      {{ wording.lost }}
    </template>
    <template #stays>
      {{ wording.stays }}
    </template>
  </Confirmation>
</template>
