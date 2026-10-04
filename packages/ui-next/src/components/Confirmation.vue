<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { ref, watch } from 'vue'
import Button from './Button.vue'
import { failureReason } from './failureReason'
import FieldError from './FieldError.vue'

const props = withDefaults(defineProps<{
  /** Names the thing: "Delete Weekend board?" */
  title: string
  /** The confirming button repeats the action's name ("Delete Screen"). There is no default: it is never "OK" or "Yes". */
  confirmLabel?: string
  /** The safe choice, which has the focus when the confirmation opens: "Keep Screen". */
  safeLabel?: string
  /**
   * What confirming does. While it runs the confirming button shows the loading mark; if it fails, the confirmation stays open and says why.
   * Left out, there is nothing to confirm: the dialog only says why something cannot be done yet, and has the safe choice alone.
   */
  action?: () => unknown
}>(), {
  safeLabel: 'Cancel',
})

const emit = defineEmits<{
  /** The action ran and the confirmation has closed. */
  confirmed: []
}>()

defineSlots<{
  /** What happens, when "Lost" and "Stays" do not say it all. */
  default?: () => unknown
  /** What is lost. */
  lost?: () => unknown
  /** What stays. */
  stays?: () => unknown
  /** Beside the safe choice of a dialog with nothing to confirm: a link to where the obstacle is removed. */
  also?: () => unknown
}>()

if (import.meta.env.DEV && props.action && !props.confirmLabel?.trim())
  throw new Error('A Confirmation needs a confirmLabel: the confirming button repeats the action\'s name.')

const open = defineModel<boolean>('open', { default: false })

const running = ref(false)
const failure = ref<string>()

watch(open, (isOpen) => {
  if (isOpen)
    failure.value = undefined
})

async function confirm() {
  running.value = true
  failure.value = undefined
  try {
    await props.action?.()
    open.value = false
    emit('confirmed')
  }
  catch (error) {
    failure.value = failureReason(error) ?? 'That did not work.'
  }
  finally {
    running.value = false
  }
}

function close(event: Event) {
  if (running.value)
    event.preventDefault()
}
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay as-child>
        <div class="scrim" />
      </AlertDialogOverlay>
      <AlertDialogContent as-child @escape-key-down="close">
        <div class="confirmation">
          <AlertDialogTitle as-child>
            <h2 class="title">
              {{ title }}
            </h2>
          </AlertDialogTitle>
          <AlertDialogDescription as-child>
            <div class="body">
              <p v-if="$slots.default">
                <slot />
              </p>
              <dl v-if="$slots.lost || $slots.stays" class="outcome">
                <div v-if="$slots.lost">
                  <dt>Lost</dt>
                  <dd><slot name="lost" /></dd>
                </div>
                <div v-if="$slots.stays">
                  <dt>Stays</dt>
                  <dd><slot name="stays" /></dd>
                </div>
              </dl>
            </div>
          </AlertDialogDescription>
          <FieldError class="failure" :message="failure" />
          <div class="buttons">
            <AlertDialogCancel as-child>
              <Button :disabled="running">
                {{ safeLabel }}
              </Button>
            </AlertDialogCancel>
            <slot name="also" />
            <Button v-if="action" :loading="running" @click="confirm">
              {{ confirmLabel }}
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
@layer components {
  .scrim {
    position: fixed;
    inset: 0;
    z-index: var(--layer-dialog);
    background: var(--color-scrim);
  }

  /* No shadow: a layer above the page is drawn with an ink border. */
  .confirmation {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: var(--layer-dialog);
    width: min(27.5rem, calc(100vw - 2 * var(--space-4)));
    max-height: calc(100dvh - 2 * var(--space-4));
    padding: var(--space-6);
    overflow-y: auto;
    border: var(--rule-heavy);
    border-radius: var(--radius);
    background: var(--color-paper);
    translate: -50% -50%;
  }

  .title {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
    text-wrap: balance;
  }

  .body {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-3);
    color: var(--color-ink-soft);
  }

  .outcome {
    display: grid;
    gap: var(--space-1);
  }

  .outcome > div {
    display: grid;
    grid-template-columns: 4.5rem minmax(0, 1fr);
    gap: var(--space-2);
  }

  .outcome dt {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .failure:not(:empty) {
    margin-top: var(--space-2);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-5);
  }

  @media (prefers-reduced-motion: no-preference) {
    .scrim[data-state='open'] {
      animation: dim var(--duration-move) var(--ease-out);
    }

    .confirmation[data-state='open'] {
      animation: arrive var(--duration-move) var(--ease-out);
    }
  }

  @keyframes dim {
    from { opacity: 0; }
  }

  @keyframes arrive {
    from {
      opacity: 0;
      translate: -50% calc(-50% + var(--space-2));
    }
  }
}
</style>
