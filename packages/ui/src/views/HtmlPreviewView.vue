<script setup lang="ts">
import { onMounted, ref, useTemplateRef, watch } from 'vue'
import exampleHtml from '@/utils/exampleHtml'

const html = ref(exampleHtml)
const previewIframeRef = useTemplateRef('previewIframeRef')

function updateIframe() {
  const iframe = previewIframeRef.value
  if (!iframe)
    return

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc)
    return
  doc.open()
  doc.write(`<html><head><link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css"><script src="https://usetrmnl.com/js/latest/plugins.js"><\/script></head><body>${html.value}</body></html>`)
  doc.close()
}

onMounted(() => {
  updateIframe()
})

watch(html, () => {
  updateIframe()
})
</script>

<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" sm="12" md="12" lg="6">
        <v-textarea v-model="html" label="HTML to render" auto-grow />
      </v-col>
      <v-col cols="12" sm="12" md="12" lg="6">
        <iframe ref="previewIframeRef" width="805" height="485" />
      </v-col>
    </v-row>
  </v-container>
</template>
