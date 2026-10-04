<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import CodeBlock from './CodeBlock.vue'

const error = 'FetchError: request to https://api.example.com/forecast failed, reason: getaddrinfo ENOTFOUND api.example.com'

const command = `curl -X POST http://kuroshiro.lan:3000/api/webhooks/… \\
  -H 'Content-Type: application/json' \\
  -d '{"temperature": 21.4}'`

const commandWithToken = command.replace('…', 'whk_9f2c41d07ab35e68')

const payload = JSON.stringify({
  station: 'Lindenplatz',
  updated: '2026-10-03T07:31:00Z',
  departures: [
    { line: 'U2', to: 'Messe', minutes: 3 },
    { line: 'U2', to: 'Flughafen', minutes: 9 },
    { line: '14', to: 'Hafen', minutes: 12 },
  ],
}, null, 2)
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default" wide>
      <CodeBlock class="stretch" :code="error" />
    </Specimen>
    <Specimen caption="with &quot;Copy&quot;: press it for copied, which reverts after 2 s" wide>
      <CodeBlock class="stretch" :code="command" :copy-value="commandWithToken" copy />
    </Specimen>
    <Specimen caption="copied" wide>
      <CodeBlock class="stretch" :code="command" copy copied />
    </Specimen>
    <Specimen caption="folded after 8 lines: press the button to show them all" wide>
      <CodeBlock class="stretch" :code="payload" :fold-after="8" copy />
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
    min-width: 0;
  }
}
</style>
