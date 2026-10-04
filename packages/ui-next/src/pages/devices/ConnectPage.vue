<script setup lang="ts">
import { computed } from 'vue'
import CopyValue from '@/components/CopyValue.vue'
import Icon from '@/components/Icon.vue'
import Notice from '@/components/Notice.vue'
import NumberedSteps from '@/components/NumberedSteps.vue'
import TuckedSection from '@/components/TuckedSection.vue'
import LoadingLine from '@/patterns/LoadingLine.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useInstanceFacts } from '@/reads/sharedReads'
import CalledInDevice from './CalledInDevice.vue'
import { useDevicesCallingIn } from './devicesCallingIn'
import RegisterByHand from './RegisterByHand.vue'
import { linkTo, sentence } from './sentence'
import SentenceLine from './SentenceLine.vue'

const CONFIGURATION_ARCHIVE_PATH = '/instance/archive'

const facts = useInstanceFacts()
const { calledIn, openedWithNoDevices, notAnswering } = useDevicesCallingIn()

const title = computed(() => openedWithNoDevices.value ? 'Connect your Device' : 'Connect a Device')
const serverHost = computed(() => facts.data && URL.parse(facts.data.serverUrl)?.hostname)

const listening = computed(() => {
  if (notAnswering.value)
    return notAnswering.value
  return calledIn.value.length > 0 ? 'Still listening, in case there is another one' : 'Waiting for a Device to call in'
})

const moving = sentence(
  'Moving from another Instance? ',
  linkTo('Import a Configuration Archive', CONFIGURATION_ARCHIVE_PATH),
  ' to bring its Devices, Screens and Plugins along.',
)
</script>

<template>
  <TitleLine :title="title" />
  <p class="lede">
    Enter this server URL on the Device's Wi-Fi setup page. The Device shows up here the moment it calls in.
  </p>

  <Notice
    v-if="facts.failure"
    class="server-url"
    title="Could not load the server URL."
    :reason="facts.failure.reason"
    action="Try again"
    @act="facts.reload"
  />
  <template v-else-if="facts.data">
    <CopyValue class="server-url" size="title" label="Copy URL" :value="facts.data.serverUrl" />
    <p v-if="facts.data.serverUrlIsLoopback" class="unreachable">
      <Icon name="problem" class="mark" />
      <span>A Device cannot reach “{{ serverHost }}”. Set <code class="variable">KUROSHIRO_API_URL</code> to this machine's address on your network and restart Kuroshiro.</span>
    </p>
  </template>

  <div class="arrivals">
    <CalledInDevice v-for="device in calledIn" :key="device.id" :device="device" />
    <LoadingLine class="listening" :class="{ first: calledIn.length === 0 }">
      {{ listening }}
    </LoadingLine>
  </div>

  <NumberedSteps class="steps">
    <li><b>Put the Device into Wi-Fi setup.</b> <span class="how">A new Device starts there. Otherwise hold its button for five seconds.</span></li>
    <li><b>Join its Wi-Fi network from your phone or laptop.</b> <span class="how">It is called TRMNL. The setup page opens by itself.</span></li>
    <li><b>Enter your Wi-Fi and the server URL above.</b> <span class="how">The URL goes into the custom server field. The Device restarts and calls in.</span></li>
  </NumberedSteps>

  <SentenceLine v-if="openedWithNoDevices" class="moving" :sentence="moving" />

  <div class="by-hand">
    <TuckedSection title="Register a Device by hand">
      <RegisterByHand />
    </TuckedSection>
  </div>
</template>

<style scoped>
@layer components {
  .lede {
    max-width: var(--measure);
    margin-top: calc(-1 * var(--space-2));
    color: var(--color-ink-soft);
  }

  .server-url {
    margin-top: var(--space-6);
  }

  .unreachable {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    max-width: 45rem;
    margin-top: var(--space-3);
    font-weight: var(--weight-medium);
  }

  .unreachable .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .variable {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .arrivals {
    margin-top: var(--space-5);
  }

  .listening {
    margin-top: var(--space-4);
  }

  .arrivals .listening.first {
    margin-top: 0;
    color: var(--color-ink);
    font-weight: var(--weight-semibold);
  }

  .steps {
    margin-top: var(--space-8);
  }

  .steps b {
    font-weight: var(--weight-semibold);
  }

  .how {
    color: var(--color-ink-soft);
  }

  p.moving {
    max-width: var(--measure);
    margin-top: var(--space-6);
    color: var(--color-ink);
  }

  .by-hand {
    max-width: 45rem;
    margin-top: var(--space-8);
  }
}
</style>
