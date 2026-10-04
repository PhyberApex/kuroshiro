<script setup lang="ts">
import type { DeletablePlugin } from './pluginWording'
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/components/Button.vue'
import Notice from '@/components/Notice.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import { useDuplicatePlugin, useExportPlugin } from './pluginActions'
import PluginDeletion from './PluginDeletion.vue'
import { usePluginPage } from './pluginPage'
import { actionsParagraph } from './pluginPageWording'
import { PLUGINS_PATH } from './pluginPaths'

const router = useRouter()
const { plugin, form, leaveFor } = usePluginPage()

const duplication = useDuplicatePlugin()
const exporting = useExportPlugin()
const deleting = ref(false)

const deletable = computed<DeletablePlugin>(() => ({
  id: plugin.value.id,
  name: plugin.value.name,
  kind: plugin.value.kind,
  deviceNames: plugin.value.assignments.map(assignment => assignment.deviceName),
  mashups: plugin.value.mashups,
}))

const duplicate = () => leaveFor(() => duplication.duplicate(plugin.value))
const download = () => leaveFor(() => exporting.download(plugin.value))

async function openList() {
  // Nothing of a deleted Plugin can be saved, so its unsaved changes are not asked about.
  form.discard()
  await nextTick()
  await router.push(PLUGINS_PATH)
}
</script>

<template>
  <TuckedSection id="actions" :title="`Duplicate, export or delete ${plugin.name}`">
    <p class="what">
      {{ actionsParagraph(plugin) }}
    </p>
    <Notice
      v-if="duplication.failure"
      class="not-duplicated"
      :title="`Could not duplicate ${plugin.name}.`"
      :reason="duplication.failure.reason"
      action="Try again"
      @act="duplicate"
    />
    <div class="buttons">
      <Button :loading="duplication.duplicating !== undefined" @click="duplicate">
        Duplicate
      </Button>
      <Button @click="download">
        {{ exporting.exported ? 'Exported' : 'Export' }}
      </Button>
      <Button @click="deleting = true">
        Delete Plugin
      </Button>
    </div>
    <p class="visually-hidden" role="status">
      {{ exporting.exported ? `Exported ${plugin.name}.` : '' }}
    </p>
  </TuckedSection>
  <PluginDeletion v-if="deleting" :plugin="deletable" @deleted="openList" @closed="deleting = false" />
</template>

<style scoped>
@layer components {
  .what {
    max-width: var(--measure);
  }

  .not-duplicated {
    margin-top: var(--space-3);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
}
</style>
