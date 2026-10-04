<script setup lang="ts">
import { useInstanceFacts, useServerTimezone } from '../../sharedReads'

const facts = useInstanceFacts()
const timezone = useServerTimezone()
</script>

<template>
  <p v-if="timezone">
    Hours and dates are in the server's timezone, {{ timezone }}.
  </p>
  <p v-if="facts.data">
    Kuroshiro {{ facts.data.version }}
  </p>
</template>
