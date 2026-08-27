import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import vuetify from '@/plugins/vuetify'
import MaintenanceIssueListCard from '../MaintenanceIssueListCard.vue'

interface Item { key: string, label: string }

const ITEMS: Item[] = [
  { key: 'a', label: 'Item A' },
  { key: 'b', label: 'Item B' },
]

function mountCard(props: { items: Item[], selected: string[] }) {
  return mount(MaintenanceIssueListCard, {
    props: { title: 'Orphaned Screen Files', ...props },
    slots: {
      default: (params: { item: { key: string } }) => h('span', { class: 'item-label' }, (params.item as Item).label),
    },
    global: { plugins: [vuetify] },
  })
}

describe('maintenanceIssueListCard', () => {
  it('renders nothing when there are no items', () => {
    const wrapper = mountCard({ items: [], selected: [] })
    expect(wrapper.find('.v-card').exists()).toBe(false)
  })

  it('renders the title and one row per item via the scoped slot', () => {
    const wrapper = mountCard({ items: ITEMS, selected: [] })
    expect(wrapper.text()).toContain('Orphaned Screen Files')
    const labels = wrapper.findAll('.item-label')
    expect(labels).toHaveLength(2)
    expect(labels[0]?.text()).toBe('Item A')
    expect(labels[1]?.text()).toBe('Item B')
  })

  it('emits update:selected with the toggled key added', async () => {
    const wrapper = mountCard({ items: ITEMS, selected: [] })
    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('update:selected')?.[0]).toEqual([['a']])
  })

  it('selects every item key when Select All is clicked', async () => {
    const wrapper = mountCard({ items: ITEMS, selected: [] })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['a', 'b']])
  })
})
