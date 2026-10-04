<script setup lang="ts">
import type { DeviceModelRead, FirmwareList } from 'kuroshiro-shared'
import { computed } from 'vue'
import TuckedSection from '@/components/TuckedSection.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import FirmwareDeletion from './FirmwareDeletion.vue'
import FirmwareRow from './FirmwareRow.vue'
import { earlierNote, newestOfficialVersion } from './firmwareWording'
import InstanceSection from './InstanceSection.vue'

const props = defineProps<{
  library: FirmwareList
  models: DeviceModelRead[]
}>()

defineEmits<{
  /** A Firmware was deleted: the library is to be read again. */
  deleted: []
}>()

const available = computed(() => props.library.firmware.filter(firmware => !firmware.deprecated))
const earlier = computed(() => props.library.firmware.filter(firmware => firmware.deprecated))
</script>

<template>
  <InstanceSection id="available" title="Available Firmware">
    <template v-if="library.lastSync" #aside>
      <span class="checked">Checked TRMNL <RelativeTime :at="library.lastSync.ranAt" /></span>
    </template>
    <ul class="rows">
      <FirmwareRow v-for="firmware in available" :key="firmware.id" :firmware="firmware" :models="models">
        <template v-if="firmware.kind === 'custom'" #actions>
          <FirmwareDeletion :firmware="firmware" @deleted="$emit('deleted')" />
        </template>
      </FirmwareRow>
    </ul>
  </InstanceSection>

  <TuckedSection v-if="earlier.length > 0" id="earlier" class="earlier" :title="`Earlier official Firmware (${earlier.length})`" heading="h3">
    <p class="replaced">
      {{ earlierNote(newestOfficialVersion(library.firmware)) }}
    </p>
    <ul class="rows earlier-rows">
      <FirmwareRow v-for="firmware in earlier" :key="firmware.id" :firmware="firmware" :models="models" />
    </ul>
  </TuckedSection>

  <p class="last">
    Kuroshiro asks TRMNL for the newest official Firmware when it starts and every day at 04:00, server time. TRMNL publishes one for the TRMNL OG only; any other Device Model needs an upload.
  </p>
</template>

<style scoped>
@layer components {
  .checked,
  .replaced,
  .last {
    color: var(--color-ink-soft);
  }

  /* A version is short, and the date at the right is long: the room goes to what the Firmware is. */
  .rows {
    --library-name-width: 7rem;
  }

  .checked {
    font-size: var(--text-sm);
  }

  .earlier {
    margin-top: var(--space-6);
  }

  .replaced,
  .last {
    max-width: var(--measure);
    text-wrap: pretty;
  }

  .earlier-rows {
    margin-top: var(--space-3);
    border-top: var(--rule);
  }

  .last {
    margin-top: var(--space-6);
  }
}
</style>
