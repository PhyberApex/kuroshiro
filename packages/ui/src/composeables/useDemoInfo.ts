import { ref } from 'vue'

export function useDemoInfo() {
  const isDemo = ref(window.location.toString().startsWith('https://kuroshiro-demo.phyberapex.de'))
  return { isDemo }
}
