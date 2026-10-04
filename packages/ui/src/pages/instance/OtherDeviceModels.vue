<script setup lang="ts">
import type { DeviceModelRead, PaletteRead } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import SearchField from '@/components/SearchField.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import DeviceModelRow from './DeviceModelRow.vue'
import { modelsMatching, noneCalled } from './deviceModelsWording'

const props = defineProps<{
  /** "The other 36 Device Models", or "All 38 Device Models" where none is in use. */
  title: string
  models: DeviceModelRead[]
  palettes: PaletteRead[]
}>()

const query = ref('')
const found = computed(() => modelsMatching(props.models, query.value))
</script>

<template>
  <TuckedSection id="other-device-models" :title="title" heading="h3">
    <div class="find">
      <SearchField v-model="query" aria-label="Find a Device Model" placeholder="Find a Device Model" />
    </div>
    <ul v-if="found.length > 0" class="rows">
      <DeviceModelRow v-for="model in found" :key="model.name" :model="model" :palettes="palettes" />
    </ul>
    <p v-else class="none-called">
      {{ noneCalled(query) }}
    </p>
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .find {
    max-width: 22rem;
  }

  .rows,
  .none-called {
    margin-top: var(--space-3);
  }

  .rows {
    border-top: var(--rule);
  }

  .none-called {
    color: var(--color-ink-soft);
  }
}
</style>
