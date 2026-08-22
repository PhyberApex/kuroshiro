export interface LayoutConfig {
  value: string
  label: string
  slots: number
}

export const MASHUP_LAYOUTS: LayoutConfig[] = [
  { value: '1Lx1R', label: '1 Left × 1 Right', slots: 2 },
  { value: '1Tx1B', label: '1 Top × 1 Bottom', slots: 2 },
  { value: '1Lx2R', label: '1 Left × 2 Right', slots: 3 },
  { value: '2Lx1R', label: '2 Left × 1 Right', slots: 3 },
  { value: '2Tx1B', label: '2 Top × 1 Bottom', slots: 3 },
  { value: '1Tx2B', label: '1 Top × 2 Bottom', slots: 3 },
  { value: '2x2', label: '2×2 Grid', slots: 4 },
]
