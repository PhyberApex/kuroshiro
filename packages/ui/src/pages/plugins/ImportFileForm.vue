<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { importPluginFile } from '@/api/plugins'
import FieldError from '@/components/FieldError.vue'
import FileDrop from '@/components/FileDrop.vue'
import { useInstanceFacts } from '@/reads/sharedReads'
import AddPluginFoot from './AddPluginFoot.vue'
import { useImportPlugin } from './importPlugin'

const facts = useInstanceFacts()
const maxBytes = computed(() => facts.data?.limits.pluginImportBytes)

const labelId = useId()
const problemId = useId()
const file = ref<File | null>(null)

const importing = useImportPlugin({
  aboutEntry: {
    'import-not-zip': true,
    'import-no-plugin': true,
    'import-legacy-format': true,
    'upload-too-large': true,
  },
})
watch(file, importing.clear)

function add() {
  const chosen = file.value
  if (!chosen)
    return importing.refuse('Choose a .zip to import.')
  return importing.run(deviceId => importPluginFile(chosen, deviceId))
}
</script>

<template>
  <form class="import-file" novalidate @submit.prevent="add">
    <div class="file" role="group" :aria-labelledby="labelId">
      <p :id="labelId" class="label">
        Plugin file
      </p>
      <FileDrop
        v-if="maxBytes !== undefined"
        v-model="file"
        :accept="['.zip']"
        :max-bytes="maxBytes"
        prompt="Drop a .zip here: a Plugin as Kuroshiro or TRMNL exports it."
        :invalid="Boolean(importing.trouble.entered)"
        :aria-describedby="importing.trouble.entered ? problemId : undefined"
      />
      <FieldError :id="problemId" :message="importing.trouble.entered" />
    </div>
    <AddPluginFoot button="Import Plugin" :running="importing.importing" :changed="!importing.imported && file !== null" :failure="importing.trouble.failure">
      Imports as the Plugin Kind the file names, a Poll Plugin if it names none. Field Values are not part of a file, so you enter them afterwards.
    </AddPluginFoot>
  </form>
</template>

<style scoped>
@layer components {
  .import-file {
    display: grid;
    gap: var(--space-4);
  }

  .label {
    padding-bottom: var(--space-1);
    font-weight: var(--weight-medium);
  }
}
</style>
