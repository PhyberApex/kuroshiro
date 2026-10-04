<script setup lang="ts">
import type { TemplateSize } from 'kuroshiro-shared'
import type { TemplateRow } from './pluginTemplates'
import type { Segment } from '@/components/SegmentedFilter.vue'
import { computed, nextTick, useTemplateRef } from 'vue'
import Button from '@/components/Button.vue'
import RowMenu from '@/components/RowMenu.vue'
import SegmentedFilter from '@/components/SegmentedFilter.vue'
import { missingSizes } from './pluginTemplates'
import { removedSentence, SIZE_IS, SIZE_NAMES, SLOT_PLACES } from './pluginTemplateWording'

/** Which Templates the Plugin has: one sentence for one, a segmented control for several, and the menu of the sizes it lacks. */
const props = defineProps<{
  rows: TemplateRow[]
  /** The sizes whose Template cannot be parsed. */
  unparsed: TemplateSize[]
}>()

const emit = defineEmits<{
  add: [size: TemplateSize]
  /** The menu has closed on the Template that was added, and the focus is free to go to the editor. */
  added: []
  remove: [size: TemplateSize]
  putBack: [size: TemplateSize]
}>()

const chosen = defineModel<TemplateSize>('chosen', { required: true })

const segments = computed(() => props.rows.map((row): Segment<TemplateSize> => ({
  value: row.size,
  label: SIZE_NAMES[row.size],
  removed: row.removed,
  problem: props.unparsed.includes(row.size) ? 'does not parse' : undefined,
})))

const chosenRow = computed(() => props.rows.find(row => row.size === chosen.value))

const missing = computed(() => missingSizes(props.rows).filter(size => size !== 'full').map(size => ({
  label: SIZE_NAMES[size],
  hint: SLOT_PLACES[size],
  select: () => emit('add', size),
  afterClose: () => emit('added'),
})))

const about = useTemplateRef('about')

/** The button that was pressed gives its place to the other one, which takes the focus. */
async function act(event: 'remove' | 'putBack') {
  if (event === 'remove')
    emit('remove', chosen.value)
  else
    emit('putBack', chosen.value)
  await nextTick()
  about.value?.querySelector('button')?.focus()
}
</script>

<template>
  <div class="template-line">
    <p v-if="rows.length === 1" class="about">
      One template. It is shown full screen and in every Mashup slot.
    </p>
    <template v-else>
      <SegmentedFilter v-model="chosen" :segments="segments" aria-label="Template" />
      <p v-if="chosenRow?.removed" ref="about" class="about">
        {{ removedSentence(chosen) }}
        <Button class="inline" variant="quiet" @click="act('putBack')">
          Put back
        </Button>
      </p>
      <p v-else ref="about" class="about">
        <b>{{ SIZE_NAMES[chosen] }}</b>: {{ SIZE_IS[chosen] }}
        <Button v-if="chosen !== 'full'" class="inline" variant="quiet" @click="act('remove')">
          Remove this template
        </Button>
      </p>
    </template>
    <RowMenu v-if="missing.length > 0" label="Add a template" :items="missing">
      <template #trigger>
        <Button variant="quiet">
          {{ rows.length === 1 ? 'Add a template for a Mashup slot' : 'Add a template' }}
        </Button>
      </template>
    </RowMenu>
  </div>
</template>

<style scoped>
@layer components {
  .template-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    min-height: var(--control-height);
  }

  .about {
    flex: 1 1 16rem;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  .about b {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  /* A button inside the sentence is as high as its line, not as a control. */
  .inline {
    min-height: 0;
    margin-left: var(--space-1);
  }
}
</style>
