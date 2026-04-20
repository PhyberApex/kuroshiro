import type { PluginVariable } from '../entities/plugin-variable.entity'
import { beforeEach, describe, expect, it } from 'vitest'
import { PluginVariableResolverService } from '../services/plugin-variable-resolver.service'

describe('pluginVariableResolverService', () => {
  let service: PluginVariableResolverService

  beforeEach(() => {
    service = new PluginVariableResolverService()
  })

  const variables: PluginVariable[] = [
    { key: 'API_KEY', value: 'secret-key-123' } as PluginVariable,
    { key: 'ENDPOINT', value: 'https://api.example.com' } as PluginVariable,
  ]

  describe('resolveVariables', () => {
    it('resolves variables with {{ }} syntax', () => {
      const text = 'Authorization: Bearer {{ API_KEY }}'
      const result = service.resolveVariables(text, variables)
      expect(result).toBe('Authorization: Bearer secret-key-123')
    })

    it('resolves variables with ${} syntax', () => {
      // eslint-disable-next-line no-template-curly-in-string
      const text = 'URL: ${ENDPOINT}/data'
      const result = service.resolveVariables(text, variables)
      expect(result).toBe('URL: https://api.example.com/data')
    })

    it('resolves multiple variables in same string', () => {
      // eslint-disable-next-line no-template-curly-in-string
      const text = '{{ API_KEY }} at ${ENDPOINT}'
      const result = service.resolveVariables(text, variables)
      expect(result).toBe('secret-key-123 at https://api.example.com')
    })

    it('handles whitespace in {{ }} syntax', () => {
      const text = '{{API_KEY}} vs {{  API_KEY  }}'
      const result = service.resolveVariables(text, variables)
      expect(result).toBe('secret-key-123 vs secret-key-123')
    })

    it('returns original text if no variables provided', () => {
      const text = 'No variables here'
      const result = service.resolveVariables(text, [])
      expect(result).toBe('No variables here')
    })

    it('returns original text if text is empty', () => {
      const result = service.resolveVariables('', variables)
      expect(result).toBe('')
    })

    it('returns text unchanged if text is null/undefined', () => {
      expect(service.resolveVariables(null as any, variables)).toBe(null)
      expect(service.resolveVariables(undefined as any, variables)).toBe(undefined)
    })

    it('resolves env vars when no plugin variables match', () => {
      const originalEnv = process.env.TEST_KUROSHIRO_VAR
      process.env.TEST_KUROSHIRO_VAR = 'test-value'
      try {
        // eslint-disable-next-line no-template-curly-in-string
        const text = 'Env: ${TEST_KUROSHIRO_VAR}'
        const variables: PluginVariable[] = [
          { key: 'OTHER_VAR', value: 'other' } as PluginVariable,
        ]
        const result = service.resolveVariables(text, variables)
        expect(result).toBe('Env: test-value')
      }
      finally {
        if (originalEnv === undefined) {
          delete process.env.TEST_KUROSHIRO_VAR
        }
        else {
          process.env.TEST_KUROSHIRO_VAR = originalEnv
        }
      }
    })
  })

  describe('resolveInObject', () => {
    it('resolves string values in object', () => {
      const obj = {
        header: 'Bearer {{ API_KEY }}',
        // eslint-disable-next-line no-template-curly-in-string
        url: '${ENDPOINT}/data',
      }
      const result = service.resolveInObject(obj, variables)
      expect(result.header).toBe('Bearer secret-key-123')
      expect(result.url).toBe('https://api.example.com/data')
    })

    it('resolves nested objects recursively', () => {
      const obj = {
        auth: {
          token: '{{ API_KEY }}',
          // eslint-disable-next-line no-template-curly-in-string
          server: '${ENDPOINT}',
        },
      }
      const result = service.resolveInObject(obj, variables)
      expect(result.auth.token).toBe('secret-key-123')
      expect(result.auth.server).toBe('https://api.example.com')
    })

    it('preserves non-string values', () => {
      const obj = {
        timeout: 30,
        enabled: true,
        data: null,
      }
      const result = service.resolveInObject(obj, variables)
      expect(result.timeout).toBe(30)
      expect(result.enabled).toBe(true)
      expect(result.data).toBe(null)
    })

    it('handles mixed types in object', () => {
      const obj = {
        // eslint-disable-next-line no-template-curly-in-string
        url: '${ENDPOINT}',
        timeout: 30,
        nested: {
          key: '{{ API_KEY }}',
          count: 5,
        },
      }
      const result = service.resolveInObject(obj, variables)
      expect(result.url).toBe('https://api.example.com')
      expect(result.timeout).toBe(30)
      expect(result.nested.key).toBe('secret-key-123')
      expect(result.nested.count).toBe(5)
    })
  })
})
