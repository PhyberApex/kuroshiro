<script setup lang="ts">
import { computed, ref } from 'vue'
import { regenerateWebhookToken } from '@/api/plugins'
import Button from '@/components/Button.vue'
import Confirmation from '@/components/Confirmation.vue'
import { usePluginPage } from './pluginPage'
import { regenerateTokenWording } from './pluginWebhook'

const emit = defineEmits<{
  /** The Plugin has been read again with its new Webhook URL. */
  regenerated: []
}>()

const { plugin, reload } = usePluginPage()

const asking = ref(false)
const wording = computed(() => regenerateTokenWording(plugin.value.name))

const regenerate = () => regenerateWebhookToken(plugin.value.id)

async function showNewAddress() {
  await reload()
  emit('regenerated')
}
</script>

<template>
  <Button class="regenerate" variant="quiet" @click="asking = true">
    Regenerate the Webhook Token
  </Button>
  <Confirmation v-model:open="asking" :title="wording.title" confirm-label="Regenerate Webhook Token" :action="regenerate" @confirmed="showNewAddress">
    {{ wording.what }}
    <template #lost>
      {{ wording.lost }}
    </template>
    <template #stays>
      {{ wording.stays }}
    </template>
  </Confirmation>
</template>

<style scoped>
@layer components {
  .regenerate {
    min-height: 0;
  }
}
</style>
