<script setup lang="ts">
import type { DeviceDetail, ScreenRead } from 'kuroshiro-shared'
import { computed, ref } from 'vue'
import { clearPickedScreen, setPickedScreen } from '@/api/screens'
import Button from '@/components/Button.vue'
import SaveState from '@/components/SaveState.vue'
import { useSaveAsChanged } from '@/components/useSaveAsChanged'

const props = defineProps<{
  screen: ScreenRead
  device: DeviceDetail
  /** Reads the Screens again, after the pick changed. */
  reload: () => Promise<void>
}>()

type Action = 'pick' | 'clear' | undefined
const action = ref<Action>()

const save = useSaveAsChanged(async (asked) => {
  if (!asked)
    return
  if (asked === 'pick')
    await setPickedScreen(props.device.id, { screenId: props.screen.id })
  else
    await clearPickedScreen(props.device.id)
  await props.reload()
}, action)

function act(asked: 'pick' | 'clear') {
  action.value = asked
  save.commit()
}

/** "Show next" on a Screen Rotation could show at the next poll, that is neither the Active Screen nor Up next; "Back to Order" on the Picked Screen instead. Hidden while Rotation is paused (a mirrored or Proxied Device). */
const offered = computed(() => !props.device.isMirrored && !props.device.isProxied && (props.screen.picked || props.screen.state === null))
</script>

<template>
  <span v-if="offered" class="screen-pick">
    <Button variant="quiet" :loading="save.status === 'saving'" @click="act(screen.picked ? 'clear' : 'pick')">
      {{ screen.picked ? 'Back to Order' : 'Show next' }}
    </Button>
    <SaveState v-if="save.status === 'failed'" :status="save.status" :reason="save.reason" @retry="save.retry" />
  </span>
</template>

<style scoped>
@layer components {
  .screen-pick {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
  }
}
</style>
