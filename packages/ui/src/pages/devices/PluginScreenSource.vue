<script setup lang="ts">
import type { ScreenPluginReference } from 'kuroshiro-shared'
import type { ProblemLine } from '@/components/problemLine'
import { computed } from 'vue'
import ProblemLines from '@/components/ProblemLines.vue'
import { pluginPath } from '@/pages/plugins/pluginPaths'
import { useNow } from '@/patterns/useNow'
import { pluginRenderedSentence } from './screenSourceWording'
import SentenceLine from './SentenceLine.vue'

const props = defineProps<{
  plugin: ScreenPluginReference
  renderedAt: string | null
}>()

const now = useNow()

const rendered = computed(() => pluginRenderedSentence(props.plugin, props.renderedAt, now.value))

const problems = computed<ProblemLine[]>(() => [
  ...props.plugin.requiredFieldEmpty
    ? [{ kind: 'problem' as const, text: 'A required Plugin Field is empty.', link: { label: 'Fill it in on the Plugin', to: pluginPath(props.plugin.id) } }]
    : [],
  ...props.plugin.fetchAlertFiring
    ? [{ kind: 'alert' as const, text: 'Alert: a Data Source of this Plugin keeps failing', link: { label: 'See it on the Plugin', to: pluginPath(props.plugin.id) } }]
    : [],
])
</script>

<template>
  <SentenceLine class="rendered" :sentence="rendered" />
  <p v-if="plugin.kind === 'Webhook'" class="soft">
    It renders again whenever its Webhook URL receives data.
  </p>
  <ProblemLines :lines="problems" />
  <p class="soft small">
    Its name, template and Data Sources are edited on the Plugin and apply to every Device it is assigned to.
  </p>
</template>

<style scoped>
@layer components {
  .rendered {
    color: var(--color-ink);
  }

  .soft {
    color: var(--color-ink-soft);
  }

  .small {
    font-size: var(--text-sm);
  }
}
</style>
