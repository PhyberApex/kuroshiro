<script setup lang="ts">
import type { ImportCheck } from 'kuroshiro-shared'
import { computed } from 'vue'
import Button from '@/components/Button.vue'
import SummaryList from '@/components/SummaryList.vue'
import SummaryRow from '@/components/SummaryRow.vue'
import { addsLine, archiveLine, LEAVES_LINE, overwritesLine, replacesLine, wordWarning } from './configurationArchiveWording'

const props = defineProps<{
  fileName: string
  check: ImportCheck
  /** The Instance has no Device. */
  fresh: boolean
  importing: boolean
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()

const overwrites = computed(() => overwritesLine(props.check))
const leavesSomething = computed(() => !props.fresh || overwrites.value !== undefined)
const toMind = computed(() => props.check.warnings.map(wordWarning))
</script>

<template>
  <SummaryList>
    <SummaryRow label="Archive">
      <span class="file">{{ fileName }}</span>
      <p>{{ archiveLine(check.archive) }}</p>
    </SummaryRow>
    <SummaryRow label="Adds">
      {{ addsLine(check) }}
    </SummaryRow>
    <SummaryRow v-if="overwrites" label="Overwrites">
      {{ overwrites }}
    </SummaryRow>
    <SummaryRow label="Replaces">
      {{ replacesLine(check.settings.overridden) }}
    </SummaryRow>
    <SummaryRow v-if="leavesSomething" label="Leaves">
      {{ LEAVES_LINE }}
    </SummaryRow>
    <SummaryRow v-if="toMind.length > 0" label="Mind" :problems="toMind" />
  </SummaryList>
  <div class="buttons">
    <Button variant="primary" :loading="importing" @click="$emit('confirm')">
      Import Configuration Archive
    </Button>
    <Button variant="quiet" :disabled="importing" @click="$emit('cancel')">
      Cancel
    </Button>
    <span class="unchanged">Nothing has changed yet.</span>
  </div>
</template>

<style scoped>
@layer components {
  .file {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    margin-top: var(--space-4);
  }

  .unchanged {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
