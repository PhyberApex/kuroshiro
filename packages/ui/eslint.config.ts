import antfu from '@antfu/eslint-config'

export default antfu(
  {},
  {
    rules: {
      'ts/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/__test__/**', '**/__tests__/**', '**/*.spec.ts'],
    rules: {
      'ts/no-explicit-any': 'warn',
    },
  },
)
