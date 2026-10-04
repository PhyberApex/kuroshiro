<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Button from '@/components/Button.vue'
import ResultLine from '@/components/ResultLine.vue'
import UnsavedChanges from '@/patterns/UnsavedChanges.vue'
import { useAddPluginPage } from './addPluginPage'

defineProps<{
  /** The name of the way's primary button, which submits the form the foot stands in: "Create Plugin". */
  button: string
  /** The Plugin is being added: the button shows the loading mark. */
  running: boolean
  /** Whether the form holds something that leaving would lose. False again once the Plugin is added. */
  changed: boolean
  /** Why nothing was added, as a sentence: "Not created. That Device does not exist." */
  failure?: string
}>()

defineSlots<{
  /** The one line under the buttons: what the admin should know before adding. */
  default: () => unknown
}>()

const { cancelTo } = useAddPluginPage()
</script>

<template>
  <div class="add-plugin-foot">
    <div class="buttons">
      <Button type="submit" variant="primary" :loading="running">
        {{ button }}
      </Button>
      <Button variant="quiet" as-child>
        <RouterLink :to="cancelTo">
          Cancel
        </RouterLink>
      </Button>
    </div>
    <ResultLine class="failure" icon="problem">
      <template v-if="failure" #default>
        {{ failure }}
      </template>
    </ResultLine>
    <p class="know">
      <slot />
    </p>
  </div>
  <UnsavedChanges :when="changed">
    <template #lost>
      What you entered for the new Plugin.
    </template>
  </UnsavedChanges>
</template>

<style scoped>
@layer components {
  .add-plugin-foot {
    margin-top: var(--space-2);
    padding-top: var(--space-4);
    border-top: var(--rule);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .add-plugin-foot .failure:not(:empty),
  .know {
    margin-top: var(--space-3);
  }

  .know {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
