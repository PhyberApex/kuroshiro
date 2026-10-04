<script setup lang="ts">
import type { MergeStrategy } from 'kuroshiro-shared'
import { useId } from 'vue'
import Field from '@/components/Field.vue'
import NumberInput from '@/components/NumberInput.vue'
import RadioRow from '@/components/RadioRow.vue'
import { MERGE_STRATEGY_CHOICES } from './addPlugin'

defineProps<{
  streamLimitProblem?: string
}>()

const mergeStrategy = defineModel<MergeStrategy>('mergeStrategy', { required: true })
const streamLimit = defineModel<number | null>('streamLimit', { required: true })

const labelId = useId()
</script>

<template>
  <div class="merge-strategy">
    <p :id="labelId" class="label">
      Merge Strategy
    </p>
    <RadioRow v-model="mergeStrategy" :choices="MERGE_STRATEGY_CHOICES" :aria-labelledby="labelId" />
  </div>
  <Field v-if="mergeStrategy === 'stream'" v-slot="{ control }" class="stream-limit" label="Stream Limit" :error="streamLimitProblem">
    <span class="keep">
      <span>Keep the newest</span>
      <NumberInput v-model="streamLimit" v-bind="control" min="1" step="1" />
      <span>entries of each array</span>
    </span>
  </Field>
</template>

<style scoped>
@layer components {
  .label {
    font-weight: var(--weight-medium);
  }

  .merge-strategy + .stream-limit {
    max-width: none;
  }

  .keep {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
  }

  .keep :deep(input) {
    width: 4.5rem;
  }
}
</style>
