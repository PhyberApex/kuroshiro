<script setup lang="ts">
import { mdiCodeBlockTags, mdiDownload, mdiEye, mdiLink, mdiStop, mdiUpload } from '@mdi/js'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { VBtn, VCard, VCardText, VCardTitle, VCol, VDivider, VFileInput, VForm, VOverlay, VRow, VSwitch, VTab, VTabs, VTextarea, VTextField, VWindow, VWindowItem } from 'vuetify/components'
import { useDemoInfo } from '@/composeables/useDemoInfo.ts'
import { useDeviceStore } from '@/stores/device.ts'
import { useScreensStore } from '@/stores/screens'
import exampleHtml from '@/utils/exampleHtml'

const props = defineProps<{ deviceId: string }>()

const screensStore = useScreensStore()
const deviceStore = useDeviceStore()

const device = computed(() => deviceStore.getById(props.deviceId))

const externalLink = ref('')
const fetchManual = ref(false)
const fileInput = ref<File | null>(null)

const previewIframeRef = useTemplateRef('previewIframeRef')

const addScreenTab = ref<'link' | 'file' | 'html'>('link')

const filename = ref('')

const filenameRules = [
  (value: string) => {
    if (!value)
      return 'Filename is required'
    return true
  },
]

const externalLinkRef = useTemplateRef('externalLinkRef')

const linkRules = [
  (value: string) => {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return true
    }
    return 'Enter a URL starting with http:// or https://'
  },
]

const linkValid = computed(() => {
  return !linkRules.map(rule => rule(externalLink.value)).some(validationResult => validationResult !== true)
})

const renderHtml = ref('')

const renderHtmlValid = computed(() => {
  return renderHtml.value !== ''
})

const addScreenInputValid = computed(() => {
  // If no device or no width or no height we can't add a screen
  if (!device.value || !device.value.width || !device.value.height)
    return false
  if (!filename.value)
    return false
  // Check for link selected
  switch (addScreenTab.value) {
    case 'link':
      return !!externalLink.value && linkValid.value
    case 'file':
      return !!fileInput.value
    case 'html':
      return renderHtmlValid.value
    default:
      { const _: never = addScreenTab.value }
      return false
  }
})

const addScreenIcon = computed(() => {
  switch (addScreenTab.value) {
    case 'file':
      return mdiUpload
    case 'link':
      return fetchManual.value ? mdiDownload : mdiLink
    case 'html':
      return mdiCodeBlockTags
    default:
      return mdiStop
  }
})

const addScreenInfo = computed(() => {
  if (addScreenTab.value !== 'link')
    return null
  return fetchManual.value
    ? 'Cached: fetched once. Update manually when the source changes.'
    : 'No cache: fetched on each request.'
})
const showHtmlPreview = ref(false)
async function renderPreviewHtml() {
  showHtmlPreview.value = true
  await nextTick()
  const iframe = previewIframeRef.value
  if (!iframe)
    return

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc)
    return
  doc.open()
  doc.write(`<html><head><link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css"><script src="https://usetrmnl.com/js/latest/plugins.js"><\/script></head><body class="environment trmnl"><div class="screen"><div class="view view--full">${renderHtml.value}</div></div></body></html>`)
  doc.close()
  showHtmlPreview.value = true
}

async function submitAddScreen() {
  if (!device.value)
    return
  if (addScreenTab.value === 'link') {
    if (!externalLink.value)
      return
    await screensStore.addScreen(device.value.id, externalLink.value, fetchManual.value, filename.value)
    externalLinkRef.value?.reset()
    fetchManual.value = false
  }
  else if (addScreenTab.value === 'file') {
    if (!fileInput.value)
      return
    await screensStore.addScreenFile(device.value.id, fileInput.value, filename.value)
    fileInput.value = null
  }
  else if (addScreenTab.value === 'html') {
    await screensStore.addScreenHtml(device.value.id, renderHtml.value, filename.value)
    renderHtml.value = ''
  }
}
const { isDemo } = useDemoInfo()
</script>

<template>
  <template v-if="device">
    <VCard class="mb-6" elevation="1">
      <VCardTitle>Add Screen</VCardTitle>
      <VDivider />
      <VCardText>
        <VTextField v-model="filename" :rules="filenameRules" label="Filename" data-test-id="filename-input" />
        <VTabs v-model="addScreenTab" grow>
          <VTab value="link" data-test-id="tab-link">
            External Link
          </VTab>
          <VTab value="file" :disabled="isDemo" data-test-id="tab-file">
            Upload File
          </VTab>
          <VTab value="html" data-test-id="tab-html">
            Render HTML
          </VTab>
        </VTabs>
        <VWindow v-model="addScreenTab">
          <VWindowItem value="link">
            <VForm>
              <VRow>
                <VCol cols="12">
                  <VTextField ref="externalLinkRef" v-model="externalLink" :rules="linkRules" label="External image link" required clearable :disabled="!device.width || !device.height" />
                  <VSwitch v-model="fetchManual" color="secondary" label="Cache image (update manually when source changes)" />
                </VCol>
              </VRow>
            </VForm>
          </VWindowItem>
          <VWindowItem value="file">
            <VForm>
              <VRow>
                <VCol cols="12">
                  <VFileInput v-model="fileInput" label="Upload image" accept="image/png, image/jpeg, image/bmp" :disabled="!device.width || !device.height" />
                </VCol>
              </VRow>
            </VForm>
          </VWindowItem>
          <VWindowItem value="html">
            <VForm>
              <VRow>
                <VCol cols="12">
                  <VTextarea v-model="renderHtml" label="HTML to render" :placeholder="exampleHtml" />
                </VCol>
              </VRow>
            </VForm>
          </VWindowItem>
        </VWindow>
        <p v-if="addScreenInfo" class="text-body-2 text-medium-emphasis mt-3 mb-0">
          {{ addScreenInfo }}
        </p>
        <VBtn
          color="primary"
          class="mt-5"
          :prepend-icon="addScreenIcon"
          :disabled="!addScreenInputValid"
          data-test-id="add-screen-btn"
          @click="submitAddScreen"
        >
          Add Screen
        </VBtn>
        <VBtn
          v-if="addScreenTab === 'html'"
          color="secondary"
          class="mt-5 ml-5"
          :prepend-icon="mdiEye"
          :disabled="!renderHtmlValid"
          @click="renderPreviewHtml()"
        >
          Preview
        </VBtn>
      </VCardText>
    </VCard>
    <VOverlay v-model="showHtmlPreview" class="align-center justify-center">
      <iframe ref="previewIframeRef" :width="(device.width || 0) + 5" :height="(device.height || 0) + 5" class="align-center" title="HTML preview" />
    </VOverlay>
  </template>
</template>
