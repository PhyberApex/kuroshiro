export const nameRules = [
  (value: string) => {
    if (!value || value.trim() === '') {
      return 'Plugin name is required'
    }
    return true
  },
]

export const templateRules = [
  (value: string) => {
    if (!value || value.trim() === '') {
      return 'Liquid template is required'
    }
    return true
  },
]

export const refreshIntervalRules = [
  (value: number) => {
    if (value < 1) {
      return 'Refresh interval must be at least 1 minute'
    }
    return true
  },
]
