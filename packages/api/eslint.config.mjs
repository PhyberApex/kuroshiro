import antfu from '@antfu/eslint-config'

export default antfu(
  {
    // Placeholder for global config
  },
  {
    files: [
      'src/**/*.controller.ts',
      'src/**/*.service.ts',
    ],
    rules: {
      'ts/consistent-type-imports': 'off',
    },
  },
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
