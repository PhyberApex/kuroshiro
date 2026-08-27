<script setup lang="ts">
import { ref } from 'vue'
import { VBtn, VCard, VCardText, VExpandTransition, VTextarea } from 'vuetify/components'
import { templateRules } from '@/utils/pluginRules'

const liquidMarkup = defineModel<string>({ required: true })

const showTemplateHelp = ref(false)
</script>

<template>
  <div>
    <div class="mb-3">
      <VBtn
        variant="text"
        size="small"
        @click="showTemplateHelp = !showTemplateHelp"
      >
        {{ showTemplateHelp ? 'Hide' : 'Show' }} Template Help
      </VBtn>
    </div>

    <VExpandTransition>
      <VCard v-show="showTemplateHelp" variant="tonal" class="mb-3">
        <VCardText class="text-body-2">
          <div class="mb-3">
            <strong>Liquid Template Syntax</strong>
          </div>
          <div class="mb-2">
            <code class="text-caption" v-text="'{{ variable }}'" /> — Display a variable
          </div>
          <div class="mb-2">
            <code class="text-caption" v-text="'{% if condition %}...{% endif %}'" /> — Conditional logic
          </div>
          <div class="mb-2">
            <code class="text-caption" v-text="'{% for item in items %}...{% endfor %}'" /> — Loop through array
          </div>
          <div class="mb-2">
            <code class="text-caption" v-text="'{{ date | date_short }}'" /> — Format with filters
          </div>
          <div class="mt-3">
            <strong>Available Filters:</strong>
            <code class="text-caption d-block mt-1">date_short, date_long, time_short, number_with_delimiter, round, truncate_words, titleize, url_encode</code>
          </div>
          <div class="mt-3 text-medium-emphasis">
            <a href="https://liquidjs.com/tutorials/intro-to-liquid.html" target="_blank" class="text-decoration-none">
              Learn more about Liquid syntax →
            </a>
          </div>
        </VCardText>
      </VCard>
    </VExpandTransition>

    <VTextarea
      v-model="liquidMarkup"
      label="Liquid Template"
      :rules="templateRules"
      required
      rows="15"
      placeholder="<div>{{ data.title }}</div>"
      hint="Use Liquid syntax to render data from the API"
    />
  </div>
</template>
