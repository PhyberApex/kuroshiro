<script setup lang="ts">
import { diffLines } from 'diff'
import { computed } from 'vue'

const props = defineProps<{
  before: string
  after: string
}>()

const parts = computed(() => diffLines(props.before, props.after))

function partClass(part: { added?: boolean, removed?: boolean }): string {
  if (part.added)
    return 'text-success'
  if (part.removed)
    return 'text-error'
  return 'text-medium-emphasis'
}
</script>

<template>
  <pre
    v-for="(part, index) in parts"
    :key="index"
    :class="partClass(part)"
  >{{ part.value }}</pre>
</template>
