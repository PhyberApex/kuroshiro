<script setup lang="ts">
import { AccordionItem } from 'reka-ui'
import { useTemplateRef } from 'vue'
import AccordionRowBody from './AccordionRowBody.vue'
import AccordionRowHeading from './AccordionRowHeading.vue'
import Checkbox from './Checkbox.vue'
import Icon from './Icon.vue'
import { openFromLine } from './openFromLine'

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

const openFromTrigger = openFromLine(() => trigger.value)
</script>

<template>
  <AccordionItem as-child :value="value">
    <li class="finding-row">
      <div class="line row-line" :data-force="force" @click="openFromTrigger">
        <Checkbox v-model="ticked" :aria-label="name" />
        <AccordionRowHeading :heading="heading">
          <button ref="trigger" type="button" class="trigger row-trigger">
            {{ name }}
          </button>
        </AccordionRowHeading>
        <span class="facts">
          <span>{{ count }}</span>
          <span class="size">{{ size }}</span>
        </span>
        <Icon name="chevron" class="chevron" />
      </div>
      <AccordionRowBody>
        <slot />
      </AccordionRowBody>
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

  /* What a group holds lines up with its name, past the checkbox. */
  .row-body :deep(.inside) {
    padding: 0 0 var(--space-5) calc(var(--icon) + var(--space-3));
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

    .row-body :deep(.inside) {
      padding-left: 0;
    }
  }
}
</style>
