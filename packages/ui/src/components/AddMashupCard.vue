<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { VAlert, VBtn, VCard, VCardText, VCardTitle, VDivider, VSelect, VTextField } from 'vuetify/components'
import { useMashupStore } from '@/stores/mashup'
import { usePluginsStore } from '@/stores/plugins'
import { useScreensStore } from '@/stores/screens'
import { MASHUP_LAYOUTS } from '@/types/mashup'

const props = defineProps<{ deviceId: string }>()

const mashupStore = useMashupStore()
const pluginsStore = usePluginsStore()
const screensStore = useScreensStore()
const filename = ref('')
const selectedLayout = ref<string>('')
const selectedPlugins = ref<string[]>([])
const error = ref<string | null>(null)
const loading = ref(false)

const layoutInfo = computed(() => {
  return MASHUP_LAYOUTS.find(l => l.value === selectedLayout.value)
})

const slotCount = computed(() => layoutInfo.value?.slots || 0)

const isValid = computed(() => {
  return filename.value.trim() !== ''
    && selectedLayout.value !== ''
    && selectedPlugins.value.length === slotCount.value
    && selectedPlugins.value.every(id => id !== '')
})

const availablePlugins = computed(() => {
  return pluginsStore.plugins.map(p => ({
    title: p.name,
    value: p.id,
  }))
})

onMounted(async () => {
  await pluginsStore.fetchPluginsForDevice(props.deviceId)
  await mashupStore.fetchLayouts()
})

function updateSlotCount() {
  selectedPlugins.value = Array.from({ length: slotCount.value }, () => '')
}

async function createMashup() {
  error.value = null
  loading.value = true

  try {
    await mashupStore.create(
      props.deviceId,
      filename.value,
      selectedLayout.value,
      selectedPlugins.value,
    )

    await screensStore.fetchScreensForDevice(props.deviceId)

    filename.value = ''
    selectedLayout.value = ''
    selectedPlugins.value = []
  }
  catch (err: any) {
    error.value = err.message || 'Failed to create mashup'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <VCard elevation="1">
    <VCardTitle>Add Mashup Screen</VCardTitle>
    <VDivider />
    <VCardText>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = null">
        {{ error }}
      </VAlert>

      <VTextField
        v-model="filename"
        label="Mashup Name"
        placeholder="My Dashboard"
        class="mb-4"
        data-test-id="mashup-filename"
      />

      <VSelect
        v-model="selectedLayout"
        :items="MASHUP_LAYOUTS"
        label="Layout"
        item-title="label"
        item-value="value"
        class="mb-4"
        data-test-id="mashup-layout"
        @update:model-value="updateSlotCount"
      />

      <div v-if="layoutInfo" class="mb-4">
        <div v-for="(_, index) in slotCount" :key="index" class="mb-3">
          <VSelect
            v-model="selectedPlugins[index]"
            :items="availablePlugins"
            :label="`Plugin ${index + 1}`"
            item-title="title"
            item-value="value"
            :data-test-id="`mashup-plugin-${index}`"
          />
        </div>
      </div>

      <VAlert v-if="!availablePlugins.length" type="info" variant="tonal" class="mb-4">
        No plugins available. Create or assign plugins to this device first.
      </VAlert>

      <VBtn
        color="primary"
        :disabled="!isValid || loading"
        :loading="loading"
        block
        data-test-id="mashup-create-btn"
        @click="createMashup"
      >
        Create Mashup
      </VBtn>
    </VCardText>
  </VCard>
</template>
