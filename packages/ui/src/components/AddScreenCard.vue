<script setup lang="ts">
import { mdiCodeBlockTags, mdiDownload, mdiEye, mdiGridLarge, mdiLink, mdiStop, mdiUpload } from '@mdi/js'
import { computed, ref, useTemplateRef } from 'vue'
import { VBtn, VCard, VCardText, VCardTitle, VCol, VDivider, VFileInput, VForm, VOverlay, VRow, VSwitch, VTab, VTabs, VTextarea, VTextField, VWindow, VWindowItem } from 'vuetify/components'
import AddMashupCard from '@/components/AddMashupCard.vue'
import ScreenFrame from '@/components/ScreenFrame.vue'
import { useDemoInfo } from '@/composeables/useDemoInfo.ts'
import { useDeviceRenderTarget } from '@/composeables/useDeviceRenderTarget'
import { useDeviceStore } from '@/stores/device.ts'
import { useScreensStore } from '@/stores/screens'
import exampleHtml from '@/utils/exampleHtml'
import { viewFull } from '@/utils/screenShell'

const props = defineProps<{ deviceId: string }>()

const screensStore = useScreensStore()
const deviceStore = useDeviceStore()

const device = computed(() => deviceStore.getById(props.deviceId))
const renderTarget = useDeviceRenderTarget(device)

const externalLink = ref('')
const fetchManual = ref(false)
const fileInput = ref<File | null>(null)

const addScreenTab = ref<'link' | 'file' | 'html' | 'mashup'>('link')

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
  if (!device.value)
    return false
  if (addScreenTab.value === 'mashup')
    return true
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
    case 'mashup':
      return mdiGridLarge
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

defineExpose({ filename, externalLink, addScreenInputValid })
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
          <VTab value="mashup" data-test-id="tab-mashup">
            Mashup
          </VTab>
        </VTabs>
        <VWindow v-model="addScreenTab">
          <VWindowItem value="link">
            <VForm>
              <VRow>
                <VCol cols="12">
                  <VTextField ref="externalLinkRef" v-model="externalLink" :rules="linkRules" label="External image link" required clearable />
                  <VSwitch v-model="fetchManual" color="secondary" label="Cache image (update manually when source changes)" />
                </VCol>
              </VRow>
            </VForm>
          </VWindowItem>
          <VWindowItem value="file">
            <VForm>
              <VRow>
                <VCol cols="12">
                  <VFileInput v-model="fileInput" label="Upload image" accept="image/png, image/jpeg, image/bmp" />
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
          <VWindowItem value="mashup">
            <AddMashupCard :device-id="deviceId" />
          </VWindowItem>
        </VWindow>
        <template v-if="addScreenTab !== 'mashup'">
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
            @click="showHtmlPreview = true"
          >
            Preview
          </VBtn>
        </template>
      </VCardText>
    </VCard>
    <VOverlay v-model="showHtmlPreview" class="align-center justify-center">
      <ScreenFrame v-if="showHtmlPreview" :body="viewFull(renderHtml)" :target="renderTarget" />
    </VOverlay>
  </template>
</template>
