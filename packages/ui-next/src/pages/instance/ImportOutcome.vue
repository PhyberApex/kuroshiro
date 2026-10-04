<script setup lang="ts">
import type { ConfigurationImportSummary } from 'kuroshiro-shared'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import ResultLine from '@/components/ResultLine.vue'
import SummaryList from '@/components/SummaryList.vue'
import SummaryRow from '@/components/SummaryRow.vue'
import { PLUGINS_PATH } from '@/pages/plugins/pluginPaths'
import { DEVICES_PATH } from '@/shell/barEntries'
import { importedSentence, wordWarning } from './configurationArchiveWording'

const props = defineProps<{
  /** What the import answered. Until there is one, only the empty status region stands here, so that the outcome is announced when it comes. */
  summary?: ConfigurationImportSummary
}>()

defineEmits<{
  another: []
}>()

const toDoNow = computed(() => props.summary?.warnings.map(wordWarning) ?? [])
</script>

<template>
  <ResultLine>
    <template v-if="summary" #default>
      <b class="imported">Imported.</b> {{ importedSentence(summary) }}
    </template>
  </ResultLine>
  <template v-if="summary">
    <SummaryList v-if="toDoNow.length > 0" class="to-do">
      <SummaryRow label="To do now" :problems="toDoNow" />
    </SummaryList>
    <div class="buttons">
      <Button as-child>
        <RouterLink :to="DEVICES_PATH">
          Devices
        </RouterLink>
      </Button>
      <Button as-child>
        <RouterLink :to="PLUGINS_PATH">
          Plugins
        </RouterLink>
      </Button>
      <Button variant="quiet" @click="$emit('another')">
        Import another
      </Button>
    </div>
  </template>
</template>

<style scoped>
@layer components {
  .imported {
    font-weight: var(--weight-semibold);
  }

  .to-do {
    margin-top: var(--space-4);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin-top: var(--space-4);
  }
}
</style>
