<script setup lang="ts">
import type { PluginPlace } from 'kuroshiro-shared'
import type { DeletablePlugin } from './pluginWording'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { isRefusal } from '@/api/client'
import { deletePlugin } from '@/api/plugins'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { devicePath } from '@/pages/devices/devicePaths'
import { lostWithPlugin, staysWithoutPlugin, whyNotDeletable } from './pluginWording'

/**
 * "Delete Plugin", open from the moment it is mounted: the confirmation, or for a Plugin that
 * fills a Mashup slot the dialog that says why it cannot be deleted yet. Mount it with the
 * Plugin to delete and unmount it on `closed`.
 */
const props = defineProps<{
  plugin: DeletablePlugin
}>()

const emit = defineEmits<{
  /** The Plugin is gone. */
  deleted: []
  /** Both dialogs have closed, whatever came of it. */
  closed: []
}>()

/** The Mashups the server refused the delete for, when the Plugin joined one after it was read. */
const refusedFor = ref<PluginPlace[]>()
const mashups = computed(() => refusedFor.value ?? props.plugin.mashups)
const onlyMashup = computed(() => mashups.value.length === 1 ? mashups.value[0] : undefined)

const asking = ref(props.plugin.mashups.length === 0)
const refusing = ref(!asking.value)

async function remove() {
  try {
    await deletePlugin(props.plugin.id)
  }
  catch (error) {
    if (!isRefusal(error, 'plugin-in-mashup'))
      throw error
    refusedFor.value = error.details.mashups as PluginPlace[]
  }
}

function afterConfirming() {
  if (refusedFor.value)
    refusing.value = true
  else
    emit('deleted')
}

watch([asking, refusing], ([isAsking, isRefusing]) => {
  if (!isAsking && !isRefusing)
    emit('closed')
})
</script>

<template>
  <Confirmation
    v-model:open="asking"
    :title="`Delete ${plugin.name}?`"
    confirm-label="Delete Plugin"
    :action="remove"
    @confirmed="afterConfirming"
  >
    <template #lost>
      {{ lostWithPlugin(plugin) }}
    </template>
    <template #stays>
      {{ staysWithoutPlugin(plugin) }}
    </template>
  </Confirmation>
  <Confirmation v-model:open="refusing" :title="`${plugin.name} cannot be deleted yet`" safe-label="Close">
    {{ whyNotDeletable(plugin.name, mashups) }}
    <template v-if="onlyMashup" #also>
      <Button as-child>
        <RouterLink :to="{ path: devicePath(onlyMashup.deviceId), query: { screen: onlyMashup.screenId } }">
          Open the Mashup
        </RouterLink>
      </Button>
    </template>
  </Confirmation>
</template>
