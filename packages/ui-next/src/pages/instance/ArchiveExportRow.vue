<script setup lang="ts">
import { onScopeDispose, ref, useId } from 'vue'
import { exportConfiguration } from '@/api/configuration'
import Button from '@/components/Button.vue'

const props = defineProps<{
  /** What this export is called: "With its secrets". */
  name: string
  /** The button's label: "Export". */
  button: string
  /** The export to restore from has the primary button. */
  primary?: boolean
  /** Exports the Redacted Archive. */
  redacted?: boolean
}>()

defineSlots<{
  /** What the export is for, one `p` per paragraph. */
  default: () => unknown
}>()

const STARTED_FOR_MS = 2000

const nameId = useId()
const started = ref(false)
let forgetting: ReturnType<typeof setTimeout> | undefined

function download() {
  exportConfiguration({ redacted: props.redacted ?? false })
  started.value = true
  clearTimeout(forgetting)
  forgetting = setTimeout(() => (started.value = false), STARTED_FOR_MS)
}

onScopeDispose(() => clearTimeout(forgetting))
</script>

<template>
  <div class="export-row" role="group" :aria-labelledby="nameId">
    <div class="what">
      <h4 :id="nameId" class="name">
        {{ name }}
      </h4>
      <slot />
    </div>
    <Button :variant="primary ? 'primary' : 'plain'" @click="download">
      {{ started ? 'Download started' : button }}
    </Button>
  </div>
</template>

<style scoped>
@layer components {
  .export-row {
    display: grid;
    /* The button's column is as wide as "Download started", so the words beside it do not wrap anew when the label changes. */
    grid-template-columns: minmax(0, 1fr) 10rem;
    align-items: center;
    justify-items: end;
    gap: var(--space-2) var(--space-6);
    padding: var(--space-4) 0;
    border-bottom: var(--rule);
  }

  .what {
    display: grid;
    justify-self: start;
    gap: var(--space-1);
    max-width: 58ch;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .name {
    margin: 0;
    color: var(--color-ink);
    font-size: var(--text-md);
    font-weight: var(--weight-semibold);
  }

  @media (max-width: 820px) {
    .export-row {
      grid-template-columns: minmax(0, 1fr);
      justify-items: start;
    }
  }
}
</style>
