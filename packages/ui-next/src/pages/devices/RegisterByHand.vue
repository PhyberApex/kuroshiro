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
import { devicePath } from './devicePaths'

type FieldErrors = Partial<Record<keyof CreateDeviceInput, string>>

const router = useRouter()
const devices = useDevices()

const name = ref('')
const mac = ref('')
const errors = ref<FieldErrors>({})
const failure = ref<string>()
const registering = ref(false)

const hexPair = (byte: number) => byte.toString(16).padStart(2, '0').toUpperCase()

function makeOneUp() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  // Locally administered and unicast: the range no manufacturer assigns, so a made-up address never is a real Device's.
  bytes[0] = (bytes[0]! & 0xFC) | 0x02
  mac.value = [...bytes].map(hexPair).join(':')
  errors.value = { ...errors.value, mac: undefined }
}

function entered(): CreateDeviceInput {
  return { name: name.value.trim(), mac: mac.value.trim() }
}

function whatIsWrong(input: CreateDeviceInput): FieldErrors {
  return {
    name: input.name ? undefined : 'A Device needs a name.',
    mac: MAC_ADDRESS_PATTERN.test(input.mac) ? undefined : 'Enter six pairs of hex digits, like A4:C1:38:5F:0B:9D.',
  }
}

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
  if (errors.value.name || errors.value.mac)
    return
  registering.value = true
  try {
    const device = await createDevice(input)
    // The page leaves before the Devices are asked for again, so the new Device is not taken for one that called in.
    await router.push(devicePath(device.id))
    void devices.reload()
  }
  catch (error) {
    errors.value = refusedFields(error)
    if (!errors.value.name && !errors.value.mac)
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
