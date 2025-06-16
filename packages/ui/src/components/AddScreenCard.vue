<script setup lang="ts">
import { mdiCodeBlockTags, mdiDownload, mdiEye, mdiLink, mdiStop, mdiUpload } from '@mdi/js'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
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
      return 'A filename is required'
    return true
  },
]

const externalLinkRef = useTemplateRef('externalLinkRef')

const linkRules = [
  (value: string) => {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return true
    }
    return 'Needs to start with http:// or https://'
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
  let title = ''
  let text = ''
  if (addScreenTab.value === 'link') {
    if (fetchManual.value) {
      title = 'External link (cached)'
      text = 'The image will be downloaded and converted now and is only updated with the link on manually.'
    }
    else {
      title = 'External link (no cache)'
      text = 'The URL will be fetched on each request dynamically and a image will be generated from it on the fly.'
    }
  }
  else if (addScreenTab.value === 'file') {
    title = 'Upload file'
    text = 'The file is uploaded, converted and will be statically served.'
  }
  else if (addScreenTab.value === 'html') {
    title = 'Render HTML'
    text = 'Enter HTML to be rendered and presented. The TRMNL framework is available.'
  }
  return { title, text }
})
const showHtmlPreview = ref(false)
async function renderPreviewHtml(html: string) {
  showHtmlPreview.value = true
  await nextTick()
  const iframe = previewIframeRef.value
  if (!iframe)
    return

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc)
    return
  doc.open()
  doc.write(`<html><head><link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css"><script src="https://usetrmnl.com/js/latest/plugins.js"><\/script></head><body>${html}</body></html>`)
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
    <v-card class="mb-6" elevation="1">
      <v-card-title>Add Screen</v-card-title>
      <v-divider />
      <v-card-text>
        <v-text-field v-model="filename" :rules="filenameRules" label="Filename" data-test-id="filename-input" />
        <v-tabs v-model="addScreenTab" grow>
          <v-tab value="link" data-test-id="tab-link">
            External Link
          </v-tab>
          <v-tab value="file" :disabled="isDemo" data-test-id="tab-file">
            Upload File
          </v-tab>
          <v-tab value="html" data-test-id="tab-html">
            Render HTML
          </v-tab>
        </v-tabs>
        <v-window v-model="addScreenTab">
          <v-window-item value="link">
            <v-form>
              <v-row>
                <v-col cols="12">
                  <v-text-field ref="externalLinkRef" v-model="externalLink" :rules="linkRules" label="External image link" required clearable :disabled="!device.width || !device.height" />
                  <v-switch v-model="fetchManual" color="secondary" label="Cache (image needs to be updated manually)" />
                </v-col>
              </v-row>
            </v-form>
          </v-window-item>
          <v-window-item value="file">
            <v-form>
              <v-row>
                <v-col cols="12">
                  <v-file-input v-model="fileInput" label="Upload image" accept="image/png, image/jpeg, image/bmp" :disabled="!device.width || !device.height" />
                </v-col>
              </v-row>
            </v-form>
          </v-window-item>
          <v-window-item value="html">
            <v-form>
              <v-row>
                <v-col cols="12">
                  <v-textarea v-model="renderHtml" label="HTML to render" :placeholder="exampleHtml" />
                </v-col>
              </v-row>
            </v-form>
          </v-window-item>
        </v-window>
        <v-card color="primary" variant="tonal" elevation="2">
          <v-card-text>
            <b>{{ addScreenInfo.title }}:</b> {{ addScreenInfo.text }}
          </v-card-text>
        </v-card>
        <v-btn
          color="primary"
          class="mt-5"
          :prepend-icon="addScreenIcon"
          :disabled="!addScreenInputValid"
          data-test-id="add-screen-btn"
          @click="submitAddScreen"
        >
          Add Screen
        </v-btn>
        <v-btn
          v-if="addScreenTab === 'html'"
          color="secondary"
          class="mt-5 ml-5"
          :prepend-icon="mdiEye"
          :disabled="!renderHtmlValid"
          @click="renderPreviewHtml(renderHtml)"
        >
          Preview
        </v-btn>
      </v-card-text>
    </v-card>
    <v-overlay v-model="showHtmlPreview" class="align-center justify-center">
      <iframe ref="previewIframeRef" :width="(device.width || 0) + 5" :height="(device.height || 0) + 5" class="align-center" />
    </v-overlay>
  </template>
</template>
