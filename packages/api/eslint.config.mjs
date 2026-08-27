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
    files: [
      'src/**/*.entity.ts',
      'src/migrations/**/*.ts',
      'src/config/typeorm.config.ts',
    ],
    rules: {
      'ts/no-restricted-imports': ['error', {
        paths: [{
          name: 'kuroshiro-shared',
          allowTypeImports: true,
          message: 'Entities and migrations are compiled unbundled; only `import type` from kuroshiro-shared here (ADR-0020).',
        }],
      }],
    },
  },
)
