<script setup lang="ts">
import type { ScreenState } from 'kuroshiro-shared'
import { AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from 'reka-ui'
import { computed, useTemplateRef, watchEffect } from 'vue'
import Icon from './Icon.vue'
import IconButton from './IconButton.vue'
import { isPassedOver, SCREEN_STATE_LABELS, useScreenRows } from './screenRows'
import Seal from './Seal.vue'
import Tooltip from './Tooltip.vue'

const props = withDefaults(defineProps<{
  /** The id of the row's item, which is also what `ScreenRows` opens it by. */
  value: string
  /** The name is the button that opens the row. */
  name: string
  /** What the row is, in `ink-soft` after the name: "Plugin", "Mashup". */
  kind?: string
  /** The Screen State, which decides the row's look. `null` is a Screen that waits its turn. */
  state?: ScreenState | null
  /** Dims the name and tells the thumbnail to dim. Left out, it follows the state: Rotation passes over every state but Active Screen and Up next. */
  passedOver?: boolean
  /** The heading the name is, by where the list sits in the page's outline. */
  heading?: 'h2' | 'h3' | 'h4'
  /** For the gallery: the state held still on the row, `hover` or `focus`. */
  force?: 'hover' | 'focus'
}>(), {
  state: null,
  passedOver: undefined,
  heading: 'h3',
})

defineSlots<{
  /** In place of the grip. */
  grip?: () => unknown
  /** In place of the row's place in the Order. */
  order?: (props: { order: number }) => unknown
  /** The thumbnail. A list without images leaves it out. */
  thumbnail?: (props: { active: boolean, passedOver: boolean }) => unknown
  /** In place of the name inside the button that opens the row. */
  name?: () => unknown
  /** In place of the kind. */
  kind?: () => unknown
  /** The Schedule's switch and summary. Controls in it work without opening the row. */
  schedule?: () => unknown
  /** In place of the Screen State's name, for a qualifier: "Active Screen, paused". The small seal stays beside it. */
  state?: () => unknown
  /** The opened row. */
  default?: () => unknown
}>()

const rows = useScreenRows()

const row = useTemplateRef('row')

const active = computed(() => props.state === 'active')
const dimmed = computed(() => props.passedOver ?? isPassedOver(props.state))
const order = computed(() => rows.orderOf(props.value))
const liftedBy = computed(() => rows.liftedBy(props.value))
const dropEdge = computed(() => rows.dropEdgeOf(props.value))

watchEffect((onCleanup) => {
  if (rows.sortable.value && row.value)
    onCleanup(rows.attach(props.value, row.value))
}, { flush: 'post' })

const CONTROLS = 'a, button, input, select, textarea, label, [role="switch"]'

/** The whole line opens the row, as the name does, except where it holds a control of its own or the admin is selecting text. */
function openFromLine(event: MouseEvent) {
  const pressed = event.target as Element
  if (pressed.closest(CONTROLS) || !getSelection()?.isCollapsed)
    return
  row.value?.querySelector<HTMLButtonElement>('.trigger')?.click()
}
</script>

<template>
  <AccordionItem as-child :value="value">
    <li
      ref="row"
      class="screen-row"
      :class="[
        state,
        {
          'sortable': rows.sortable.value,
          'passed-over': dimmed,
          'lifted': liftedBy,
          'drop-before': dropEdge === 'before',
          'drop-after': dropEdge === 'after',
        },
      ]"
    >
      <div class="line" :data-force="force" @click="openFromLine">
        <template v-if="rows.sortable.value">
          <slot name="grip">
            <Tooltip :text="`Move ${name} in the Order`">
              <button
                type="button"
                class="grip"
                data-grip
                :aria-label="`Move ${name} in the Order`"
                :aria-describedby="rows.gripHelpId"
                :aria-pressed="liftedBy === 'keyboard'"
                :data-force="rows.gripForce(value)"
                @keydown="rows.pressGrip(value, $event)"
                @blur="rows.leaveGrip(value)"
              >
                <Icon name="grip" />
              </button>
            </Tooltip>
          </slot>
          <span class="nudge">
            <IconButton
              icon="up"
              data-move="earlier"
              :label="`Move ${name} earlier in the Order`"
              :disabled="order === 1"
              @click="rows.nudge(value, -1)"
            />
            <IconButton
              icon="down"
              data-move="later"
              :label="`Move ${name} later in the Order`"
              :disabled="order === rows.total.value"
              @click="rows.nudge(value, 1)"
            />
          </span>
          <span class="order"><slot name="order" :order="order">{{ order }}</slot></span>
        </template>
        <span v-if="$slots.thumbnail" class="thumbnail">
          <slot name="thumbnail" :active="active" :passed-over="dimmed" />
        </span>
        <div class="cells">
          <div class="naming">
            <AccordionHeader as-child>
              <component :is="heading" class="heading">
                <AccordionTrigger as-child>
                  <button type="button" class="trigger">
                    <slot name="name">
                      {{ name }}
                    </slot>
                  </button>
                </AccordionTrigger>
              </component>
            </AccordionHeader>
            <span v-if="kind || $slots.kind" class="kind"><slot name="kind">{{ kind }}</slot></span>
          </div>
          <div class="schedule">
            <slot name="schedule" />
          </div>
          <div class="state">
            <Seal v-if="active" :size="16" />
            <slot name="state">
              {{ state ? SCREEN_STATE_LABELS[state] : '' }}
            </slot>
          </div>
        </div>
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
  .screen-row {
    --grip-width: 1rem;
    --order-width: 1.25rem;

    border-bottom: var(--rule);
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--space-3);
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

  .grip {
    position: relative;
    display: grid;
    flex: none;
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
  .screen-row.lifted .grip {
    color: var(--color-ink);
  }

  .screen-row.lifted .grip {
    cursor: grabbing;
  }

  .nudge {
    display: none;
  }

  .order {
    flex: none;
    width: var(--order-width);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .screen-row.active .order {
    color: var(--color-ink);
  }

  .thumbnail {
    flex: none;
  }

  .cells {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(0, 1fr) 14.5rem 9.5rem;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    min-width: 0;
  }

  .heading {
    font-size: inherit;
  }

  .trigger {
    max-width: 100%;
    font-weight: var(--weight-semibold);
    overflow-wrap: anywhere;
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the row. */
  .line:is(:hover, [data-force~='hover']) .trigger {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .screen-row.passed-over .trigger {
    color: var(--color-ink-soft);
  }

  .kind {
    display: block;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .schedule {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .state {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .screen-row.active .state {
    color: var(--color-ink);
    font-weight: var(--weight-semibold);
  }

  .screen-row.upNext .state {
    color: var(--color-ink);
    font-weight: var(--weight-medium);
  }

  .chevron {
    color: var(--color-ink-soft);
    transition:
      rotate var(--duration-move) var(--ease-out),
      color var(--duration-move) var(--ease-out);
  }

  .screen-row[data-state='open'] .chevron {
    color: var(--color-ink);
    rotate: 180deg;
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
    padding: var(--space-2) 0 var(--space-6);
  }

  .screen-row.sortable .inside {
    padding-left: calc(var(--grip-width) + var(--order-width) + 2 * var(--space-3));
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

  /* On phone the grip and the Order give way to two move buttons, and the cells stand under the name. */
  @media (max-width: 820px) {
    .line {
      align-items: flex-start;
    }

    .grip,
    .order {
      display: none;
    }

    .nudge {
      display: grid;
      flex: none;
    }

    .cells {
      grid-template-columns: minmax(0, 1fr);
    }

    .chevron {
      margin-top: calc((1lh - var(--icon)) / 2);
    }

    .screen-row.sortable .inside {
      padding-left: 0;
    }
  }
}
</style>
