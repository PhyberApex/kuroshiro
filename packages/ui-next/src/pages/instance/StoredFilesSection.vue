<script setup lang="ts">
import type { StoredFiles } from './storedFiles'
import { computed } from 'vue'
import Button from '@/components/Button.vue'
import Notice from '@/components/Notice.vue'
import ResultLine from '@/components/ResultLine.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { cleanedSentence, notRemoved, screenImagesSentence } from './housekeepingWording'
import InstanceSection from './InstanceSection.vue'
import StoredFindings from './StoredFindings.vue'

const props = defineProps<{
  storedFiles: StoredFiles
}>()

const state = computed(() => props.storedFiles.state)
const checked = computed(() => state.value.step === 'checked' ? state.value.check : undefined)
const found = computed(() => (checked.value?.findings.length ?? 0) > 0)

const cleaned = computed(() => {
  const done = props.storedFiles.cleaned
  return done && { sentence: cleanedSentence(done.result.removed), notice: notRemoved(done.result.failed, done.findings) }
})

/** What the status line says: that the check runs, that nothing is left, or what a clean-up removed above the findings left. */
const said = computed(() => {
  if (state.value.step === 'checking')
    return 'Checking stored files'
  if (!checked.value)
    return undefined
  const after = found.value ? undefined : `Nothing to clean up. ${screenImagesSentence(checked.value.screenImages)}`
  return [cleaned.value?.sentence, after].filter(Boolean).join(' ') || undefined
})
</script>

<template>
  <InstanceSection id="stored-files" title="Stored files">
    <template #aside>
      <Button :loading="state.step === 'checking'" @click="storedFiles.check">
        Check again
      </Button>
    </template>
    <div class="stored-files">
      <Notice
        v-if="cleaned?.notice"
        :title="cleaned.notice.title"
        :reason="cleaned.notice.reasons.join(' ')"
      />
      <Notice
        v-if="state.step === 'failed'"
        title="Could not check the stored files."
        :reason="state.reason"
        action="Try again"
        @act="storedFiles.check"
      />
      <ResultLine :running="state.step === 'checking'">
        <template v-if="said" #default>
          <b v-if="cleaned?.sentence && state.step === 'checked'">Cleaned up.</b>{{ ' ' }}{{ said }}
        </template>
      </ResultLine>
      <template v-if="checked && found">
        <p class="totals">
          {{ screenImagesSentence(checked.screenImages) }} Checked <RelativeTime :at="checked.checkedAt" />.
        </p>
        <StoredFindings :check="checked" :clean-up="storedFiles.cleanUp" />
      </template>
    </div>
  </InstanceSection>
</template>

<style scoped>
@layer components {
  .stored-files {
    margin-top: var(--space-4);
  }

  /* The status line is in the page before it says anything, and takes no room until it does. */
  .stored-files > :not(:empty) ~ * {
    margin-top: var(--space-3);
  }

  .stored-files b {
    font-weight: var(--weight-semibold);
  }

  .totals {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }
}
</style>
