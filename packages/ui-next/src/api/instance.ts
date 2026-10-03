import type { InstanceFacts } from 'kuroshiro-shared'
import { apiGet } from './client'

export function getInstanceFacts() {
  return apiGet<InstanceFacts>('instance')
}
