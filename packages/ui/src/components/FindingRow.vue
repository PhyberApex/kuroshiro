<script setup lang="ts">
import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from 'reka-ui'
import { useTemplateRef } from 'vue'
import Checkbox from './Checkbox.vue'
import Icon from './Icon.vue'

withDefaults(defineProps<{
  /** What `FindingRows` opens the row by. */
  value: string
  /** The group of findings. It names the checkbox and is the button that opens the row. */
  name: string
  /** How many the group holds, with what is counted: "6 files". */
  count: string
  /** What the group takes on disk: "412 KB". A group that takes nothing has none. */
  size?: string
  /** The heading the name is, by where the list sits in the page's outline. */
  heading?: 'h3' | 'h4'
  /** For the gallery: the state held still on the row, `hover` or `focus`. */
  force?: 'hover' | 'focus'
}>(), {
  heading: 'h4',
})

defineSlots<{
  /** The opened row: what the group holds. */
  default?: () => unknown
}>()

/** Whether the group is among what the next clean-up removes. */
const ticked = defineModel<boolean>('ticked', { default: false })

const trigger = useTemplateRef('trigger')

const CONTROLS = 'a, button, input, select, textarea, label'

/** The whole line opens the row, as the name does, except the checkbox and while the admin is selecting text. */
function openFromLine(event: MouseEvent) {
  const pressed = event.target as Element
  if (pressed.closest(CONTROLS) || !getSelection()?.isCollapsed)
    return
  trigger.value?.click()
}
</script>

<template>
  <AccordionItem as-child :value="value">
    <li class="finding-row">
      <div class="line" :data-force="force" @click="openFromLine">
        <Checkbox v-model="ticked" :aria-label="name" />
        <AccordionHeader as-child>
          <component :is="heading" class="heading">
            <AccordionTrigger as-child>
              <button ref="trigger" type="button" class="trigger">
                {{ name }}
              </button>
            </AccordionTrigger>
          </component>
        </AccordionHeader>
        <span class="facts">
          <span>{{ count }}</span>
          <span class="size">{{ size }}</span>
        </span>
        <Icon name="chevron" class="chevron" />
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
  .finding-row {
    border-bottom: var(--rule);
  }

  .line {
    display: grid;
    grid-template-columns: var(--icon) minmax(0, 1fr) auto var(--icon);
    align-items: center;
    gap: var(--space-1) var(--space-3);
    min-height: var(--hit-target);
    padding: var(--space-2) 0;
    border-radius: var(--radius);
    cursor: pointer;
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
    font-weight: var(--weight-medium);
    text-align: left;
    overflow-wrap: anywhere;
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the row. */
  .line:is(:hover, [data-force~='hover']) .trigger {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .facts {
    display: grid;
    grid-template-columns: 6.5rem 5rem;
    gap: var(--space-3);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .size {
    text-align: right;
  }

  .chevron {
    color: var(--color-ink-soft);
    transition:
      rotate var(--duration-move) var(--ease-out),
      color var(--duration-move) var(--ease-out);
  }

  .finding-row[data-state='open'] .chevron {
    color: var(--color-ink);
    rotate: 180deg;
  }

  .body {
    overflow: hidden;
  }

  /* What a group holds lines up with its name, past the checkbox. */
  .inside {
    padding: 0 0 var(--space-5) calc(var(--icon) + var(--space-3));
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

  /* On phone the count and the size go under the name. */
  @media (max-width: 820px) {
    .line {
      grid-template-columns: var(--icon) minmax(0, 1fr) var(--icon);
    }

    .facts {
      display: flex;
      grid-area: 2 / 2;
    }

    .chevron {
      grid-area: 1 / 3;
    }

    .inside {
      padding-left: 0;
    }
  }
}
</style>
