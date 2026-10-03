<script setup lang="ts">
import { computed } from 'vue'
import Button from './Button.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** The form differs from what is saved. The bar is there only while it does. */
  changed: boolean
  /** The label of the page's primary button: "Save Plugin". */
  saveLabel: string
  /** The label of the button that puts every field back: "Discard changes". */
  cancelLabel?: string
  /** The save is running. */
  saving?: boolean
  /** What stops the save, when a value is invalid: "2 things to fix before this can be saved." It comes with "Show the first". */
  invalid?: string
  /** The save was refused or did not arrive. */
  failed?: boolean
  /** Why, as a sentence. */
  reason?: string
}>(), {
  cancelLabel: 'Cancel',
})

defineEmits<{
  /** The primary button or "Try again" was pressed. */
  save: []
  cancel: []
  /** "Show the first" was pressed: the page opens what holds the first invalid field and focuses it. */
  showFirst: []
}>()

defineSlots<{
  /** What has changed, after "Unsaved changes": "to the template and Data Sources. The preview already shows them." */
  default?: () => unknown
}>()

const notSaved = computed(() => ['Not saved.', props.reason].filter(Boolean).join(' '))

const announcement = computed(() => {
  if (!props.changed)
    return ''
  if (props.invalid)
    return props.invalid
  return props.failed ? notSaved.value : 'Unsaved changes'
})
</script>

<template>
  <span class="visually-hidden" role="status">{{ announcement }}</span>
  <section v-if="changed" v-bind="$attrs" class="save-bar" aria-label="Unsaved changes">
    <p v-if="invalid" class="said">
      <b>{{ invalid }}</b>
      <Button variant="quiet" @click="$emit('showFirst')">
        Show the first
      </Button>
    </p>
    <p v-else-if="failed" class="said">
      <b>{{ notSaved }}</b>
      <Button variant="quiet" :disabled="saving" @click="$emit('save')">
        Try again
      </Button>
    </p>
    <p v-else class="said">
      <span class="what"><b>Unsaved changes</b> <slot /></span>
    </p>
    <div class="buttons">
      <Button variant="quiet" :disabled="saving" @click="$emit('cancel')">
        {{ cancelLabel }}
      </Button>
      <Button variant="primary" :loading="saving" @click="$emit('save')">
        {{ saveLabel }}
      </Button>
    </div>
  </section>
</template>

<style scoped>
@layer components {
  /*
  Sticky, not fixed: at the end of the page the bar stands in its own place under the last
  content and covers none of it. No shadow: the heavy rule is what lifts it off the page.
  */
  .save-bar {
    position: sticky;
    bottom: 0;
    z-index: var(--layer-bar);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-6);
    margin-top: var(--space-10);
    padding: var(--space-3) 0;
    border-top: var(--rule-heavy);
    background: var(--color-paper);
  }

  .said {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--space-3);
    max-width: var(--measure);
  }

  .what {
    color: var(--color-ink-soft);
  }

  .said b {
    color: var(--color-ink);
    font-weight: var(--weight-semibold);
  }

  .buttons {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-left: auto;
  }

  /* On a phone the bottom tabs are fixed to the window's edge, and the bar stands on them. */
  @media (max-width: 820px) {
    .save-bar {
      bottom: calc(var(--bar-height) + env(safe-area-inset-bottom));
    }
  }
}
</style>
