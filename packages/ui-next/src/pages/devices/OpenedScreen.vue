<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { imageUrl } from '@/api/client'
import Button from '@/components/Button.vue'
import Plate from '@/components/Plate.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { useNow } from '@/patterns/useNow'
import { useServerTimezone } from '@/reads/sharedReads'
import { screenName } from './screenNaming'
import { screenWhy } from './screenWording'

const props = defineProps<{
  screen: ScreenRead
  /** The Device's Screens in the Order the rows stand in. */
  screens: ScreenRead[]
  device: DeviceDetail
  /** Whether the Screen can jump to the top and to the end of the Order, as on a Device with many Screens. */
  jumps?: boolean
}>()

const emit = defineEmits<{
  /** The Screen is to move by so many places in the Order; an infinite number is the top or the end. */
  move: [by: number]
}>()

defineSlots<{
  /** The Schedule editor. */
  schedule?: () => unknown
  /** What the Screen is made from, by its kind. */
  source?: () => unknown
  /** The actions before the move buttons: "Rename". */
  actionsBefore?: () => unknown
  /** The destructive action, after the move buttons. */
  actionsAfter?: () => unknown
}>()

const now = useNow()
const timezone = useServerTimezone()

const name = computed(() => screenName(props.screen.name))
const why = computed(() => screenWhy({ screen: props.screen, screens: props.screens, device: props.device, now: now.value, timezone: timezone.value }))

const CAPTIONS_OF_KIND: Partial<Record<ScreenRead['kind'], (device: DeviceDetail) => string>> = {
  file: () => 'The converted image',
  html: device => `As ${device.name} renders it`,
}
const caption = computed(() => props.screen.imagePath
  ? CAPTIONS_OF_KIND[props.screen.kind]?.(props.device)
  : 'Not rendered yet. It renders when its turn first comes.')

const place = computed(() => props.screens.findIndex(screen => screen.id === props.screen.id))
const isFirst = computed(() => place.value === 0)
const isLast = computed(() => place.value === props.screens.length - 1)
const moves = computed(() => [
  { label: 'Move up', by: -1, disabled: isFirst.value },
  { label: 'Move down', by: 1, disabled: isLast.value },
  ...props.jumps
    ? [
        { label: 'Move to top', by: Number.NEGATIVE_INFINITY, disabled: isFirst.value },
        { label: 'Move to end', by: Number.POSITIVE_INFINITY, disabled: isLast.value },
      ]
    : [],
])

const actions = useTemplateRef('actions')
let movedFromHere = false

function move(by: number) {
  movedFromHere = true
  emit('move', by)
}

// A move button that has reached the end of the Order is disabled and drops the focus, which the next one takes.
watch(place, async () => {
  if (!movedFromHere)
    return
  movedFromHere = false
  await nextTick()
  if (!actions.value?.contains(document.activeElement))
    actions.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
}, { flush: 'post' })
</script>

<template>
  <div class="opened-screen">
    <p v-for="(line, index) in why" :key="line" class="why" :class="{ also: index > 0 }">
      {{ line }}
    </p>
    <figure class="preview">
      <Plate
        :name="`${name}, as rendered for ${device.name}`"
        :src="screen.imagePath && imageUrl(screen.imagePath)"
        :width="device.deviceModel?.width"
        :height="device.deviceModel?.height"
      />
      <figcaption class="caption">
        <template v-if="caption">
          {{ caption }}
        </template>
        <template v-else-if="screen.renderedAt">
          Rendered <RelativeTime :at="screen.renderedAt" />
        </template>
      </figcaption>
    </figure>
    <div class="parts">
      <slot name="schedule" />
      <slot name="source" />
      <div ref="actions" class="actions">
        <slot name="actionsBefore" />
        <Button v-for="action in moves" :key="action.label" variant="quiet" :disabled="action.disabled" @click="move(action.by)">
          {{ action.label }}
        </Button>
        <slot name="actionsAfter" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .opened-screen {
    display: grid;
    grid-template-columns: 18.5rem minmax(0, 1fr);
    align-items: start;
    gap: var(--space-4) var(--space-8);
  }

  .why {
    grid-column: 1 / -1;
    max-width: 70ch;
  }

  .why.also {
    margin-top: calc(var(--space-2) * -1);
    color: var(--color-ink-soft);
  }

  .caption {
    margin-top: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .parts {
    display: grid;
    gap: var(--space-6);
    min-width: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .actions:not(:first-child) {
    padding-top: var(--space-4);
    border-top: var(--rule);
  }

  @media (max-width: 820px) {
    .opened-screen {
      grid-template-columns: minmax(0, 1fr);
    }

    .preview {
      max-width: 18.5rem;
    }
  }
}
</style>
