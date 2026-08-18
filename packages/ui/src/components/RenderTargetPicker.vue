<script setup lang="ts">
import type { RenderTarget } from '@/utils/screenShell'
import { computed, onMounted, ref, watch } from 'vue'
import { VCol, VRow, VSelect } from 'vuetify/components'
import { useDeviceModelsStore } from '@/stores/deviceModels'
import { DEFAULT_MODEL, DEFAULT_MODEL_NAME, DEFAULT_PALETTE, richestPalette } from '@/utils/renderTarget'

const emit = defineEmits<{ 'update:modelValue': [target: RenderTarget] }>()

const deviceModelsStore = useDeviceModelsStore()

const selectedModelName = ref(DEFAULT_MODEL_NAME)
const selectedPaletteId = ref<string | null>(null)

onMounted(() => deviceModelsStore.ensureLoaded())

const modelOptions = computed(() => deviceModelsStore.activeModels.map(model => ({
  title: `${model.label} (${model.width}x${model.height})`,
  value: model.name,
})))

const selectedModel = computed(() => deviceModelsStore.getByName(selectedModelName.value) ?? DEFAULT_MODEL)
const allowedPalettes = computed(() => deviceModelsStore.palettesFor(selectedModel.value))
const paletteOptions = computed(() => allowedPalettes.value.map(palette => ({ title: palette.name, value: palette.id })))

const target = computed<RenderTarget>(() => ({
  model: selectedModel.value,
  palette: allowedPalettes.value.find(p => p.id === selectedPaletteId.value) ?? richestPalette(allowedPalettes.value) ?? DEFAULT_PALETTE,
}))

watch(selectedModel, (model) => {
  if (selectedPaletteId.value && !model.paletteIds.includes(selectedPaletteId.value))
    selectedPaletteId.value = null
})

watch(target, value => emit('update:modelValue', value), { immediate: true })
</script>

<template>
  <VRow dense>
    <VCol cols="12" sm="7">
      <VSelect v-model="selectedModelName" :items="modelOptions" density="compact" hide-details label="Preview as device model" data-test-id="render-target-model" />
    </VCol>
    <VCol cols="12" sm="5">
      <VSelect v-model="selectedPaletteId" :items="paletteOptions" density="compact" hide-details label="Palette" :placeholder="target.palette.name" persistent-placeholder data-test-id="render-target-palette" />
    </VCol>
  </VRow>
</template>
