<script setup lang="ts">
import type { PluginFieldDraft } from './pluginFields'
import { AccordionContent, AccordionItem, AccordionTrigger } from 'reka-ui'
import { computed, useId, useTemplateRef, watchEffect } from 'vue'
import Button from '@/components/Button.vue'
import Icon from '@/components/Icon.vue'
import IconButton from '@/components/IconButton.vue'
import { useScreenRows } from '@/components/screenRows'
import Tooltip from '@/components/Tooltip.vue'
import PluginFieldForm from './PluginFieldForm.vue'
import { typeName } from './pluginFields'

/**
 * One Plugin Field as a row: its keyname, its label and its type, with "Edit", which opens its form in place.
 * It stands in a sortable `ScreenRows`, whose grip, keys and two buttons on phone it takes its place by.
 */
defineProps<{
  /** The path a save sends the Plugin Field at: `fields.2`. A removed one is not sent and has none. */
  path?: string
  /** The form's problems, by path. */
  errors: Record<string, string>
}>()

defineEmits<{
  remove: []
}>()

const field = defineModel<PluginFieldDraft>('field', { required: true })

const rows = useScreenRows()
const row = useTemplateRef('row')
const titleId = useId()

const keyname = computed(() => field.value.keyname.trim())
const place = computed(() => rows.orderOf(field.value.key))
const liftedBy = computed(() => rows.liftedBy(field.value.key))
const dropEdge = computed(() => rows.dropEdgeOf(field.value.key))

watchEffect((onCleanup) => {
  if (row.value && !field.value.removed)
    onCleanup(rows.attach(field.value.key, row.value))
}, { flush: 'post' })
</script>

<template>
  <AccordionItem v-slot="{ open }" as-child :value="field.key" :disabled="field.removed">
    <li
      ref="row"
      class="plugin-field-row"
      :class="{ 'removed': field.removed, 'lifted': liftedBy, 'drop-before': dropEdge === 'before', 'drop-after': dropEdge === 'after' }"
    >
      <div class="line">
        <template v-if="!field.removed">
          <Tooltip :text="`Move ${keyname}`">
            <button
              type="button"
              class="grip"
              data-grip
              :aria-label="`Move ${keyname}`"
              :aria-describedby="rows.gripHelpId"
              :aria-pressed="liftedBy === 'keyboard'"
              @keydown="rows.pressGrip(field.key, $event)"
              @blur="rows.leaveGrip(field.key)"
            >
              <Icon name="grip" />
            </button>
          </Tooltip>
          <span class="nudge">
            <IconButton icon="up" data-move="earlier" :label="`Move ${keyname} earlier`" :disabled="place === 1" @click="rows.nudge(field.key, -1)" />
            <IconButton icon="down" data-move="later" :label="`Move ${keyname} later`" :disabled="place === rows.total.value" @click="rows.nudge(field.key, 1)" />
          </span>
        </template>
        <h3 :id="titleId" class="keyname">
          {{ keyname }}
        </h3>
        <span :id="`${titleId}-kind`" hidden>Plugin Field</span>
        <span class="label">
          <template v-if="field.label.trim()">{{ field.label.trim() }}</template>
          <span v-else class="soft">no label</span>
          <span v-if="field.required" class="soft">{{ ' ' }}· required</span>
        </span>
        <span v-if="field.removed" class="removal">
          Removed when you save, with its Field Value ·
          <Button variant="quiet" class="put-back" :aria-label="`Put back ${keyname}`" @click="field.removed = false">
            Put back
          </Button>
        </span>
        <template v-else>
          <span class="type">{{ typeName(field.type) }}</span>
          <AccordionTrigger as-child>
            <Button variant="quiet" class="edit" :aria-label="open ? `Done editing ${keyname}` : `Edit ${keyname}`">
              {{ open ? 'Done' : 'Edit' }}
            </Button>
          </AccordionTrigger>
        </template>
      </div>
      <AccordionContent as-child>
        <div class="body" :aria-labelledby="`${titleId}-kind ${titleId}`">
          <div v-if="path" class="inside">
            <PluginFieldForm v-model:field="field" :path="path" :errors="errors" @remove="$emit('remove')" />
          </div>
        </div>
      </AccordionContent>
    </li>
  </AccordionItem>
</template>

<style scoped>
@layer components {
  .plugin-field-row {
    --grip-width: 1rem;

    border-bottom: var(--rule);
  }

  .line {
    display: grid;
    grid-template-columns: var(--grip-width) minmax(0, 10rem) minmax(0, 1fr) minmax(0, 9rem) auto;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    min-height: var(--hit-target);
    padding: var(--space-2) 0;
  }

  .grip {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--grip-width);
    height: var(--control-height);
    border-radius: var(--radius-inner);
    color: var(--color-ink-soft);
    cursor: grab;
    transition: color var(--duration-quick) var(--ease-out);
  }

  /* The grip is 16 px wide; this is the 44 px a finger or a near miss lands on. */
  .grip::before {
    content: "";
    position: absolute;
    inset: 0 calc((var(--grip-width) - var(--hit-target)) / 2);
  }

  .grip:is(:hover, [aria-pressed='true']),
  .plugin-field-row.lifted .grip {
    color: var(--color-ink);
  }

  .plugin-field-row.lifted .grip {
    cursor: grabbing;
  }

  .nudge {
    display: none;
  }

  .keyname {
    grid-column: 2;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    overflow-wrap: anywhere;
  }

  .label {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .soft,
  .type,
  .removal {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .removal {
    grid-column: 4 / -1;
    text-align: right;
  }

  .plugin-field-row.removed :is(.keyname, .label) {
    color: var(--color-ink-soft);
    text-decoration: line-through;
  }

  /* In the row's line a button is as high as the line of text it stands in. */
  .put-back {
    min-height: 0;
  }

  /* The lifted row: on wash, in a 1 px ink outline. The 2 px ink line is where it will land. */
  .lifted {
    outline: 1px solid var(--color-ink);
    outline-offset: -1px;
    background: var(--color-wash);
  }

  .drop-before {
    box-shadow: 0 -2px 0 var(--color-ink);
  }

  .drop-after {
    box-shadow: 0 2px 0 var(--color-ink);
  }

  .body {
    overflow: hidden;
  }

  .inside {
    padding: var(--space-2) 0 var(--space-5) calc(var(--grip-width) + var(--space-3));
  }

  /* On phone the grip and the type give way: two move buttons, the keyname over the label, and "Edit". */
  @media (max-width: 820px) {
    .line {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }

    .grip,
    .type {
      display: none;
    }

    .nudge {
      display: grid;
      grid-row: 1 / span 2;
    }

    .label {
      grid-area: 2 / 2;
    }

    .edit {
      grid-area: 1 / 3 / span 2;
    }

    .removal {
      grid-column: 2 / -1;
      text-align: left;
    }

    .inside {
      padding-left: 0;
    }
  }
}
</style>
