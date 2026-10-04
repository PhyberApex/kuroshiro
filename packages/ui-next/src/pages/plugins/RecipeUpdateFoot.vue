<script setup lang="ts">
import type { RecipeUpdateMode } from 'kuroshiro-shared'
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import Notice from '@/components/Notice.vue'
import { pluginPath } from './pluginPaths'
import { applyButton } from './recipeUpdate'

/** How the check ends: apply what is checked, skip it all, or leave without recording anything. */
defineProps<{
  pluginId: string
  /** How many Update Items are checked. */
  chosen: number
  /** How many the check found. */
  offered: number
  mode: RecipeUpdateMode
  sending?: 'apply' | 'skip'
  notSent?: { reason?: string }
}>()

defineEmits<{
  apply: []
  skip: []
}>()
</script>

<template>
  <div class="foot">
    <Notice v-if="notSent" class="not-sent" title="Nothing was applied." :reason="notSent.reason" />
    <div class="buttons">
      <Button variant="primary" :disabled="chosen === 0 || sending === 'skip'" :loading="sending === 'apply'" @click="$emit('apply')">
        {{ applyButton(chosen) }}
      </Button>
      <Button :disabled="sending === 'apply'" :loading="sending === 'skip'" @click="$emit('skip')">
        {{ mode === 'two-way' ? 'Apply nothing and save the Recipe Snapshot' : `Skip all ${offered}` }}
      </Button>
      <Button variant="quiet" as-child>
        <RouterLink :to="pluginPath(pluginId)">
          Cancel
        </RouterLink>
      </Button>
    </div>
    <p class="under">
      Either button makes the Recipe as it is now the Recipe Snapshot, so an Update Item you leave unchecked is not offered again. Cancel records nothing.
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .foot {
    margin-top: var(--space-10);
    padding-top: var(--space-5);
    border-top: var(--rule);
  }

  .not-sent {
    margin-bottom: var(--space-4);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .under {
    max-width: var(--measure);
    margin-top: var(--space-3);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }
}
</style>
