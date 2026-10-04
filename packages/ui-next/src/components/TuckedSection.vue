<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { watch } from 'vue'
import Icon from './Icon.vue'
import { useUrlFragment } from './urlFragment'

const props = withDefaults(defineProps<{
  title: string
  /** What stands beside the title, softer: "14 names, fetched 4 min ago". It is part of what the trigger is called. */
  note?: string
  /** The anchor of the section. An address that ends in `#` and this id opens it. */
  id?: string
  /** The heading the title is, by where the section sits in the page's outline. */
  heading?: 'h2' | 'h3' | 'h4'
  /** For the gallery: the state held still on the trigger, `hover` or `focus`. */
  force?: 'hover' | 'focus'
}>(), {
  heading: 'h2',
})

const open = defineModel<boolean>('open', { default: false })

const fragment = useUrlFragment()

watch(fragment, (named) => {
  if (props.id && named === props.id)
    open.value = true
}, { immediate: true })
</script>

<template>
  <CollapsibleRoot :id="id" v-model:open="open" class="tucked-section">
    <component :is="heading" class="heading">
      <CollapsibleTrigger as-child>
        <button type="button" class="trigger" :data-force="force">
          <span class="said">
            <span class="title">{{ title }}</span>
            <template v-if="note">
              {{ ' ' }}
              <span class="note">{{ note }}</span>
            </template>
          </span>
          <Icon name="chevron" class="chevron" />
        </button>
      </CollapsibleTrigger>
    </component>
    <CollapsibleContent as-child>
      <div class="content">
        <div class="inside">
          <slot />
        </div>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>

<style scoped>
@layer components {
  .tucked-section {
    border-block: var(--rule);
    scroll-margin-top: var(--space-4);
  }

  .tucked-section + .tucked-section {
    border-top: 0;
  }

  .heading {
    font-size: inherit;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--hit-target);
    font-weight: var(--weight-semibold);
  }

  .said {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-3);
    min-width: 0;
    text-align: left;
  }

  .note {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    font-weight: var(--weight-regular);
  }

  .chevron {
    flex: none;
    color: var(--color-ink-soft);
    transition:
      rotate var(--duration-move) var(--ease-out),
      color var(--duration-move) var(--ease-out);
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the trigger. */
  .trigger:is(:hover, [data-force~='hover']) .title {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .trigger[data-state='open'] .chevron {
    color: var(--color-ink);
    rotate: 180deg;
  }

  .content {
    overflow: hidden;
  }

  .inside {
    padding-bottom: var(--space-4);
  }

  @media (prefers-reduced-motion: no-preference) {
    .content[data-state='open'] {
      animation: unfold var(--duration-move) var(--ease-out);
    }

    .content[data-state='closed'] {
      animation: fold var(--duration-move) var(--ease-out);
    }
  }

  @keyframes unfold {
    from { height: 0; }
    to { height: var(--reka-collapsible-content-height); }
  }

  @keyframes fold {
    from { height: var(--reka-collapsible-content-height); }
    to { height: 0; }
  }
}
</style>
