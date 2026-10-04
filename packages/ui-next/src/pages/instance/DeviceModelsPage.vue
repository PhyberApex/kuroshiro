<script setup lang="ts">
import { listDeviceModels, listPalettes, syncDeviceModels } from '@/api/device-models'
import Button from '@/components/Button.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import { useNow } from '@/patterns/useNow'
import CustomPalettes from './CustomPalettes.vue'
import DeviceModelLibrary from './DeviceModelLibrary.vue'
import { syncOutcome, whyNotSynced } from './deviceModelsWording'
import InstancePageHeading from './InstancePageHeading.vue'
import LibraryLoading from './LibraryLoading.vue'
import { useTrmnlSync } from './trmnlSync'
import TrmnlSyncOutcome from './TrmnlSyncOutcome.vue'

const page = useLoad(async () => {
  const [list, palettes] = await Promise.all([listDeviceModels(), listPalettes()])
  return { list, palettes }
})

const sync = useTrmnlSync(syncDeviceModels, page.reload)
const now = useNow()
</script>

<template>
  <InstancePageHeading title="Device Models and Palettes">
    <template #actions>
      <Button :disabled="sync.running || !page.data" @click="sync.sync">
        Sync from TRMNL
      </Button>
    </template>
  </InstancePageHeading>
  <div class="body">
    <LoadBody :load="page" loading="Loading the Device Models and Palettes" failed="Could not load the Device Models and Palettes.">
      <template #skeleton>
        <LibraryLoading />
      </template>
      <template #default="{ data }">
        <p class="lede">
          What Kuroshiro knows about panels. A Device Model sets an image's size, a Palette the greys or colours it is reduced to. Which ones a Device uses is chosen in that Device's Settings.
        </p>
        <TrmnlSyncOutcome
          :running="sync.running"
          asking="Asking TRMNL for its Device Models and Palettes"
          :outcome="sync.result && syncOutcome(sync.result, data.list.models)"
          :failed="sync.failed"
          :reason="whyNotSynced(sync.reason, data.list.models, now)"
          @retry="sync.sync"
        />
        <CustomPalettes :palettes="data.palettes" :models="data.list.models" @changed="page.reload" />
        <DeviceModelLibrary :list="data.list" :palettes="data.palettes" />
        <p class="last">
          Kuroshiro syncs both from TRMNL when it starts and every day at 04:00, server time. Without a connection it uses the list it was shipped with.
        </p>
      </template>
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  /* A Device Model's label and a Palette's name are longer than a version: the name column is the wide one. The skeleton keeps the same column. */
  .body {
    --library-name-width: 13rem;

    margin-top: var(--space-3);
  }

  .lede,
  .last {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .last {
    margin-top: var(--space-6);
  }
}
</style>
