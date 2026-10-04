<script setup lang="ts">
import type { CreateDeviceInput } from 'kuroshiro-shared'
import { MAC_ADDRESS_PATTERN } from 'kuroshiro-shared'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fieldErrorsOf, isRefusal } from '@/api/client'
import { createDevice } from '@/api/devices'
import Button from '@/components/Button.vue'
import { failureReason } from '@/components/failureReason'
import Field from '@/components/Field.vue'
import ResultLine from '@/components/ResultLine.vue'
import TextInput from '@/components/TextInput.vue'
import { useDevices } from '@/reads/sharedReads'
import { deviceNameProblem } from './deviceNaming'
import { devicePath } from './devicePaths'
import { madeUpMac } from './madeUpMac'

type FieldErrors = Partial<Record<keyof CreateDeviceInput, string>>

const emit = defineEmits<{
  /** A Device was registered, before its Screens view opens: the page must not take it for one that called in. */
  registered: [deviceId: string]
}>()

const router = useRouter()
const devices = useDevices()

const name = ref('')
const mac = ref('')
const errors = ref<FieldErrors>({})
const failure = ref<string>()
const registering = ref(false)

function makeOneUp() {
  mac.value = madeUpMac()
  errors.value = { ...errors.value, mac: undefined }
}

function entered(): CreateDeviceInput {
  return { name: name.value.trim(), mac: mac.value.trim() }
}

function whatIsWrong(input: CreateDeviceInput): FieldErrors {
  return {
    name: deviceNameProblem(input.name),
    mac: MAC_ADDRESS_PATTERN.test(input.mac) ? undefined : 'Enter six pairs of hex digits, like A4:C1:38:5F:0B:9D.',
  }
}

const hasProblems = ({ name: nameError, mac: macError }: FieldErrors) => Boolean(nameError || macError)

function refusedFields(error: unknown): FieldErrors {
  if (isRefusal(error, 'device-mac-taken'))
    return { mac: error.message }
  const { name: nameError, mac: macError } = fieldErrorsOf(error)
  return { name: nameError, mac: macError }
}

async function register() {
  const input = entered()
  errors.value = whatIsWrong(input)
  failure.value = undefined
  if (hasProblems(errors.value))
    return
  registering.value = true
  try {
    const device = await createDevice(input)
    emit('registered', device.id)
    await router.push(devicePath(device.id))
    void devices.reload()
  }
  catch (error) {
    errors.value = refusedFields(error)
    if (!hasProblems(errors.value))
      failure.value = failureReason(error) ?? 'Something went wrong.'
  }
  finally {
    registering.value = false
  }
}
</script>

<template>
  <p class="for">
    For a Device that cannot call the setup address itself, or to try Kuroshiro with the Device Simulator. A Device registered here appears at once and waits for its first poll.
  </p>
  <form class="register-by-hand" novalidate @submit.prevent="register">
    <Field v-slot="{ control }" label="Name" :error="errors.name">
      <TextInput v-model="name" v-bind="control" prose wide autocomplete="off" />
    </Field>
    <Field
      v-slot="{ control }"
      label="MAC address"
      hint="Six pairs of hex digits. Make one up only for a Device that has no real one."
      :error="errors.mac"
    >
      <span class="mac">
        <TextInput v-model="mac" v-bind="control" autocomplete="off" autocapitalize="characters" spellcheck="false" />
        <Button variant="quiet" @click="makeOneUp">
          Make one up
        </Button>
      </span>
    </Field>
    <div class="send">
      <Button type="submit" :loading="registering">
        Register Device
      </Button>
      <ResultLine icon="problem">
        <template v-if="failure" #default>
          Not registered. {{ failure }}
        </template>
      </ResultLine>
    </div>
  </form>
</template>

<style scoped>
@layer components {
  .for {
    max-width: var(--measure);
    color: var(--color-ink-soft);
  }

  .register-by-hand {
    display: grid;
    gap: var(--space-4);
    padding-top: var(--space-4);
  }

  .register-by-hand :deep(.field) {
    width: 100%;
  }

  .mac {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .send {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }
}
</style>
