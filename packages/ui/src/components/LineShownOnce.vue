<script setup lang="ts">
import { ref } from 'vue'
import Button from './Button.vue'

const emit = defineEmits<{
  dismiss: []
}>()

defineSlots<{
  /** What just happened: "Created. It shows its name until you write its template." */
  default: () => unknown
}>()

const dismissed = ref(false)

function dismiss() {
  dismissed.value = true
  emit('dismiss')
}
</script>

<template>
  <div v-if="!dismissed" class="line-shown-once">
    <p role="status">
      <slot />
    </p>
    <Button class="dismiss" variant="quiet" @click="dismiss">
      Dismiss
    </Button>
  </div>
</template>

<style scoped>
@layer components {
  .line-shown-once {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-1) var(--space-4);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius);
    background: var(--color-wash);
  }

  .line-shown-once .dismiss {
    margin-left: auto;
  }
}
</style>
