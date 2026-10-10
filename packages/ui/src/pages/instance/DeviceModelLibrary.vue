<script setup lang="ts">
import type { DeviceModelList, PaletteRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import DeviceModelRow from './DeviceModelRow.vue'
import { checkedNote, inUseAndOthers, othersTitle } from './deviceModelsWording'
import InstanceSection from './InstanceSection.vue'
import OtherDeviceModels from './OtherDeviceModels.vue'
import TrmnlPalettes from './TrmnlPalettes.vue'

const props = defineProps<{
  list: DeviceModelList
  palettes: PaletteRead[]
}>()

const byUse = computed(() => inUseAndOthers(props.list.models))
const official = computed(() => props.palettes.filter(palette => palette.kind === 'official'))
</script>

<template>
  <InstanceSection id="device-models" title="Device Models">
    <template #aside>
      <span class="from-trmnl">
        {{ list.models.length }} from TRMNL<template v-if="list.lastSync">, {{ checkedNote(list.lastSync) }} <RelativeTime :at="list.lastSync.ranAt" /></template>
      </span>
    </template>
    <ul v-if="byUse.inUse.length > 0" class="in-use">
      <DeviceModelRow v-for="model in byUse.inUse" :key="model.name" :model="model" :palettes="palettes" />
    </ul>
    <p v-else class="none">
      No Device uses one yet. A Device is given its Device Model from what it reports at its first poll.
    </p>
  </InstanceSection>

  <div class="tucked">
    <OtherDeviceModels v-if="byUse.others.length > 0" :title="othersTitle(byUse)" :models="byUse.others" :palettes="palettes" />
    <TrmnlPalettes :palettes="official" />
  </div>
</template>

<style scoped>
@layer components {
  .from-trmnl,
  .none {
    color: var(--color-ink-soft);
  }

  .from-trmnl {
    font-size: var(--text-sm);
  }

  .none {
    max-width: var(--measure);
    margin-top: var(--space-3);
    text-wrap: pretty;
  }

  .tucked {
    margin-top: var(--space-6);
  }
}
</style>
