<script setup lang="ts">
import type { RecipeUpdateMode, UpdateItem } from 'kuroshiro-shared'
import { computed, ref, useId } from 'vue'
import Checkbox from '@/components/Checkbox.vue'
import Icon from '@/components/Icon.vue'
import { updateItemName } from './recipeUpdate'
import RecipeUpdateDetail from './RecipeUpdateDetail.vue'

/** One Update Item: its checkbox, what it is, how it changed and whether you changed it too. The name opens its diff. */
const props = defineProps<{
  item: UpdateItem
  mode: RecipeUpdateMode
  pluginName: string
  /** A required Plugin Field that applying leaves without a value or a default. */
  leftEmpty: boolean
}>()

const checked = defineModel<boolean>('checked', { required: true })

const open = ref(false)
const detailId = useId()
const name = computed(() => updateItemName(props.item))
const called = computed(() => [name.value.what, name.value.code].filter(Boolean).join(' '))
</script>

<template>
  <li class="update-row" :class="{ open }">
    <div class="line">
      <span class="pick">
        <Checkbox v-model="checked" :aria-label="`Apply ${called}`" />
      </span>
      <button type="button" class="name" :aria-expanded="open" :aria-controls="open ? detailId : undefined" @click="open = !open">
        {{ name.what }}<template v-if="name.code">
          {{ ' ' }}<code class="code">{{ name.code }}</code>
        </template>
      </button>
      <span class="kind">{{ item.kind }}</span>
      <span class="conflict">
        <template v-if="item.conflict">
          <Icon name="problem" class="mark" />
          <span>Conflict: you changed this too</span>
        </template>
      </span>
      <Icon :name="open ? 'up' : 'down'" class="chevron" />
    </div>
    <RecipeUpdateDetail v-if="open" :id="detailId" :item="item" :mode="mode" :called="called" :plugin-name="pluginName" :left-empty="leftEmpty" />
  </li>
</template>

<style scoped>
@layer components {
  .update-row {
    border-bottom: var(--rule);
  }

  .line {
    position: relative;
    display: grid;
    grid-template-columns: var(--icon) minmax(0, 1fr) 5rem minmax(0, 17rem) var(--icon);
    align-items: center;
    gap: var(--space-3);
    min-height: var(--hit-target);
    padding: var(--space-2) 0;
  }

  /* The checkbox stands above the name's cover, which makes the rest of the line open the row. */
  .pick {
    position: relative;
    z-index: 1;
    display: flex;
  }

  .name {
    font-weight: var(--weight-medium);
    text-align: start;
    overflow-wrap: anywhere;
  }

  .name::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .line:hover .name {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .code {
    font-family: var(--font-mono);
    font-size: 0.92em;
  }

  .kind {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-soft);
  }

  .conflict {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .chevron {
    color: var(--color-ink-soft);
  }

  .open .chevron {
    color: var(--color-ink);
  }

  @media (max-width: 820px) {
    .line {
      grid-template-columns: var(--icon) minmax(0, 1fr) var(--icon);
      gap: var(--space-1) var(--space-3);
    }

    .kind,
    .conflict {
      grid-column: 2;
    }

    .conflict:empty {
      display: none;
    }

    .chevron {
      grid-row: 1;
      grid-column: 3;
    }
  }
}
</style>
