<script setup lang="ts">
import RelativeTime from '../../RelativeTime.vue'

defineProps<{ at: string }>()
</script>

<template>
  <p>Last seen <RelativeTime :at="at" /></p>
</template>
