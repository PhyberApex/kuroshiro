<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listDeviceModels } from '@/api/device-models'
import { listFirmware, syncFirmware } from '@/api/firmware'
import { getInstanceSettings } from '@/api/instance'
import Button from '@/components/Button.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import { useLoad } from '@/patterns/useLoad'
import FirmwareAutoUpdateRow from './FirmwareAutoUpdateRow.vue'
import FirmwareLibrary from './FirmwareLibrary.vue'
import { newestOfficialVersion, syncOutcome } from './firmwareWording'
import InstancePageHeading from './InstancePageHeading.vue'
import { UPLOAD_FIRMWARE_PATH } from './instancePaths'
import LibraryLoading from './LibraryLoading.vue'
import NoFirmwareYet from './NoFirmwareYet.vue'
import { useTrmnlSync } from './trmnlSync'
import TrmnlSyncOutcome from './TrmnlSyncOutcome.vue'

const page = useLoad(async () => {
  const [library, { models }, settings] = await Promise.all([listFirmware(), listDeviceModels(), getInstanceSettings()])
  return { library, models, autoUpdateOn: settings.firmwareAutoUpdate.value }
})

/** What the switch saved since the page loaded. */
const switchedTo = ref<boolean>()
const autoUpdateOn = computed(() => switchedTo.value ?? page.data?.autoUpdateOn ?? false)

/** Worded by the switch as it stood when the sync was asked for, which is what decided whether a Device was given the Firmware. */
const sync = useTrmnlSync(async () => {
  const on = autoUpdateOn.value
  return syncOutcome(await syncFirmware(), on)
}, page.reload)
</script>

<template>
  <InstancePageHeading title="Firmware">
    <template #actions>
      <Button as-child>
        <RouterLink :to="UPLOAD_FIRMWARE_PATH">
          Upload Firmware
        </RouterLink>
      </Button>
      <Button variant="primary" :disabled="sync.running || !page.data" @click="sync.sync">
        Sync from TRMNL
      </Button>
    </template>
  </InstancePageHeading>
  <div class="body">
    <LoadBody :load="page" loading="Loading the Firmware" failed="Could not load the Firmware.">
      <template #skeleton>
        <LibraryLoading />
      </template>
      <template #default="{ data }">
        <p class="lede">
          Every Firmware a Device can be pushed to. Which one a Device gets is chosen in that Device's Settings.
        </p>
        <TrmnlSyncOutcome
          :running="sync.running"
          asking="Asking TRMNL for the newest official Firmware"
          :outcome="sync.result"
          :failed="sync.failed"
          :reason="sync.reason"
          @retry="sync.sync"
        />
        <div class="auto-update">
          <FirmwareAutoUpdateRow :on="autoUpdateOn" :newest-version="newestOfficialVersion(data.library.firmware)" @saved="switchedTo = $event" />
        </div>
        <FirmwareLibrary v-if="data.library.firmware.length > 0" :library="data.library" :models="data.models" @deleted="page.reload" />
        <NoFirmwareYet v-else :syncing="sync.running" @sync="sync.sync" />
      </template>
    </LoadBody>
  </div>
</template>

<style scoped>
@layer components {
  /* A version is short and the date at a row's right is long: the room goes to what the Firmware is. The skeleton keeps the same column. */
  .body {
    --library-name-width: 7rem;

    margin-top: var(--space-3);
  }

  .lede {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .auto-update {
    margin-top: var(--space-4);
  }
}
</style>
