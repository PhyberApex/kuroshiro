<script setup lang="ts">
import { onMounted, ref, useTemplateRef, watch } from 'vue'
import { VCol, VContainer, VRow, VTextarea } from 'vuetify/components'
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
  doc.write(`<html><head><link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css"><script src="https://usetrmnl.com/js/latest/plugins.js"><\/script></head><body class="environment trmnl"><div class="screen"><div class="view view--full">${html.value}</div></div></body></html>`)
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
  <VContainer fluid>
    <VRow justify="center">
      <VCol cols="12" sm="12" md="12" lg="6">
        <VTextarea v-model="html" label="HTML to render" auto-grow />
      </VCol>
      <VCol cols="12" sm="12" md="12" lg="6">
        <iframe ref="previewIframeRef" class="preview-iframe" title="HTML preview" />
      </VCol>
    </VRow>
  </VContainer>
</template>

<style scoped>
.preview-iframe {
  width: 100%;
  min-height: 320px;
  aspect-ratio: 805 / 485;
  max-width: 805px;
  border: 0;
  display: block;
}
</style>
