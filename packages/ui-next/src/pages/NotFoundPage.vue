<script setup lang="ts">
import MissingPage from '@/patterns/MissingPage.vue'
</script>

<template>
  <MissingPage title="No page here" :back="{ label: 'Go to the start', to: '/' }">
    The address may be mistyped, or what it named is gone.
  </MissingPage>
</template>
