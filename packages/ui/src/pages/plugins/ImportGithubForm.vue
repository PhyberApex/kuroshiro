<script setup lang="ts">
import { githubRepositoryOf } from 'kuroshiro-shared'
import { ref, watch } from 'vue'
import { importGithubPlugin } from '@/api/plugins'
import { NOT_A_REPOSITORY } from '@/api/refusalWording'
import Field from '@/components/Field.vue'
import Notice from '@/components/Notice.vue'
import TextInput from '@/components/TextInput.vue'
import AddPluginFoot from './AddPluginFoot.vue'
import { useImportPlugin } from './importPlugin'

const entered = ref('')

const importing = useImportPlugin({
  upstream: 'github.com',
  aboutEntry: {
    'github-url-invalid': true,
    'github-repo-not-found': true,
    'import-no-plugin': 'This repository holds no Plugin at its root.',
  },
})
watch(entered, importing.clear)

function add() {
  const githubUrl = entered.value.trim()
  if (!githubRepositoryOf(githubUrl))
    return importing.refuse(NOT_A_REPOSITORY)
  return importing.run(deviceId => importGithubPlugin({ githubUrl, deviceId }))
}
</script>

<template>
  <form class="import-github" novalidate @submit.prevent="add">
    <Field
      v-slot="{ control }"
      class="repository"
      label="Repository"
      hint="A public repository with the Plugin at its root, on the branch main."
      :error="importing.trouble.entered"
    >
      <TextInput v-model="entered" v-bind="control" type="url" wide placeholder="https://github.com/owner/repository" autocomplete="off" spellcheck="false" />
    </Field>
    <Notice v-if="importing.trouble.unanswered" :title="importing.trouble.unanswered" reason="Nothing was imported." action="Try again" @act="add" />
    <AddPluginFoot button="Import Plugin" :running="importing.importing" :changed="!importing.imported && entered.trim() !== ''" :failure="importing.trouble.failure">
      Imports as the Plugin Kind the repository names, a Poll Plugin if it names none. Copied once: later changes in the repository do not reach it.
    </AddPluginFoot>
  </form>
</template>

<style scoped>
@layer components {
  .import-github {
    display: grid;
    gap: var(--space-4);
  }

  .import-github .repository {
    max-width: none;
  }
}
</style>
