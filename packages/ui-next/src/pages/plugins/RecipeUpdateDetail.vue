<script setup lang="ts">
import type { RecipeUpdateMode, UpdateItem } from 'kuroshiro-shared'
import { computed } from 'vue'
import Diff from '@/components/Diff.vue'
import { conflictSentence, linesOf, recipeChange } from './recipeUpdate'

/** An opened Update Item: for a conflict your own version first, then the Recipe's change, then what applying a Plugin Field means. */
const props = defineProps<{
  item: UpdateItem
  mode: RecipeUpdateMode
  /** "Template full". */
  called: string
  pluginName: string
  leftEmpty: boolean
}>()

const yours = computed(() => linesOf(props.item, 'local'))
const change = computed(() => recipeChange(props.item, props.mode))
</script>

<template>
  <div class="detail">
    <template v-if="item.conflict">
      <p class="said">
        {{ conflictSentence(item.itemType) }}
      </p>
      <p class="caption">
        Yours reads:
      </p>
      <Diff v-if="yours.length > 0" :before="yours" :after="yours" :fold="false" :label="`Your ${called}`" />
      <p v-else class="said">
        You removed it from {{ pluginName }}.
      </p>
      <p class="caption">
        The Recipe's change:
      </p>
    </template>
    <Diff :before="change.before" :after="change.after" :label="`The Recipe's change to ${called}`" />
    <p v-if="item.itemType === 'field' && item.kind === 'removed'" class="note">
      Its Field Value is removed with it.
    </p>
    <p v-if="leftEmpty" class="note">
      It is required and has no default, so {{ pluginName }} is marked until you fill it in.
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .detail {
    display: grid;
    gap: var(--space-2);
    padding: 0 0 var(--space-5) calc(var(--icon) + var(--space-3));
  }

  .said,
  .caption,
  .note {
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }

  .caption {
    margin-top: var(--space-2);
  }

  .said + .caption {
    margin-top: 0;
  }

  .note {
    margin-top: var(--space-1);
  }

  @media (max-width: 820px) {
    .detail {
      padding-left: 0;
    }
  }
}
</style>
