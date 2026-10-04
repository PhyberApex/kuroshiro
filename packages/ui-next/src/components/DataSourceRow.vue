<script setup lang="ts">
import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from 'reka-ui'
import { useTemplateRef } from 'vue'
import Icon from './Icon.vue'

withDefaults(defineProps<{
  /** What `DataSourceRows` opens the row by. */
  value: string
  /** The name the template reads the Data Source by. It is the button that opens the row. */
  name: string
  /** What the Data Source is, in one line that is cut with an ellipsis: "GET api.open-meteo.com/v1/forecast". */
  what: string
  /** The Data Source leaves with the next save: struck through, and not to be opened. */
  removed?: boolean
  /** The heading the name is, by where the list sits in the page's outline. */
  heading?: 'h2' | 'h3'
  /** For the gallery: the state held still on the row, `hover` or `focus`. */
  force?: 'hover' | 'focus'
}>(), {
  heading: 'h3',
})

defineSlots<{
  /** How the Data Source is doing, or that it is removed, with the button that puts it back. Controls in it work without opening the row. */
  health?: () => unknown
  /** The opened row. */
  default?: () => unknown
}>()

const trigger = useTemplateRef('trigger')

const CONTROLS = 'a, button, input, select, textarea, label'

/** The whole line opens the row, as the name does, except where it holds a control of its own or the admin is selecting text. */
function openFromLine(event: MouseEvent) {
  const pressed = event.target as Element
  if (pressed.closest(CONTROLS) || !getSelection()?.isCollapsed)
    return
  trigger.value?.click()
}
</script>

<template>
  <AccordionItem as-child :value="value" :disabled="removed">
    <li class="data-source-row" :class="{ removed }">
      <div class="line" :data-force="force" @click="openFromLine">
        <AccordionHeader as-child>
          <component :is="heading" class="heading">
            <AccordionTrigger as-child>
              <button ref="trigger" type="button" class="trigger">
                {{ name }}
              </button>
            </AccordionTrigger>
          </component>
        </AccordionHeader>
        <span class="what">{{ what }}</span>
        <div class="health">
          <slot name="health" />
        </div>
        <Icon v-if="!removed" name="chevron" class="chevron" />
      </div>
      <AccordionContent as-child>
        <div class="body">
          <div class="inside">
            <slot />
          </div>
        </div>
      </AccordionContent>
    </li>
  </AccordionItem>
</template>

<style scoped>
@layer components {
  .data-source-row {
    border-bottom: var(--rule);
  }

  .line {
    display: grid;
    grid-template-columns: minmax(0, 11rem) minmax(0, 1fr) minmax(0, 15rem) var(--icon);
    align-items: center;
    gap: var(--space-1) var(--space-4);
    min-height: var(--hit-target);
    padding: var(--space-2) 0;
    border-radius: var(--radius);
    cursor: pointer;
  }

  .data-source-row.removed .line {
    cursor: default;
  }

  .line:has(.trigger:focus-visible) {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
  }

  .trigger:focus-visible {
    outline: 0;
  }

  .heading {
    min-width: 0;
    font-size: inherit;
  }

  .trigger {
    max-width: 100%;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    text-align: left;
    overflow-wrap: anywhere;
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the row. */
  .data-source-row:not(.removed) .line:is(:hover, [data-force~='hover']) .trigger {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .what {
    overflow: hidden;
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .data-source-row.removed :is(.trigger, .what) {
    color: var(--color-ink-soft);
    text-decoration: line-through;
  }

  .data-source-row.removed .trigger {
    cursor: default;
  }

  .health {
    min-width: 0;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .chevron {
    grid-column: 4;
    color: var(--color-ink-soft);
    transition:
      rotate var(--duration-move) var(--ease-out),
      color var(--duration-move) var(--ease-out);
  }

  .data-source-row[data-state='open'] .chevron {
    color: var(--color-ink);
    rotate: 180deg;
  }

  .body {
    overflow: hidden;
  }

  .inside {
    padding: var(--space-2) 0 var(--space-8);
  }

  @media (prefers-reduced-motion: no-preference) {
    .body[data-state='open'] {
      animation: unfold var(--duration-move) var(--ease-out);
    }

    .body[data-state='closed'] {
      animation: fold var(--duration-move) var(--ease-out);
    }
  }

  @keyframes unfold {
    from { height: 0; }
    to { height: var(--reka-accordion-content-height); }
  }

  @keyframes fold {
    from { height: var(--reka-accordion-content-height); }
    to { height: 0; }
  }

  /* On phone the row stacks to the name, the line and the health, with the chevron beside the name. */
  @media (max-width: 820px) {
    .line {
      grid-template-columns: minmax(0, 1fr) var(--icon);
      align-items: start;
    }

    .line > * {
      grid-column: 1;
    }

    .chevron {
      grid-area: 1 / 2;
      margin-top: calc((1lh - var(--icon)) / 2);
    }

    .health:empty {
      display: none;
    }
  }
}
</style>
