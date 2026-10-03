import { HttpException, InternalServerErrorException, MethodNotAllowedException, UnprocessableEntityException } from '@nestjs/common'
import { QueryFailedError } from 'typeorm'
import { describe, expect, it } from 'vitest'
import { toApiError } from '../api-exception.filter.js'
import { toApiErrorFields } from '../api-validation.pipe.js'

describe('toApiError', () => {
  it.each([
    [new UnprocessableEntityException('Cannot use that'), 422, 'unprocessable'],
    [new HttpException('Upstream down', 502), 502, 'bad-gateway'],
    [new HttpException('Sidecar down', 503), 503, 'service-unavailable'],
    [new HttpException('Too big', 413), 413, 'payload-too-large'],
    [new HttpException('Not here', 403), 403, 'forbidden'],
    [new MethodNotAllowedException('Not available in demo mode'), 405, 'bad-request'],
    [new InternalServerErrorException('Render failed'), 500, 'internal'],
    [new HttpException('Timed out', 504), 504, 'internal'],
  ])('gives %s the generic code of its status', (exception, statusCode, code) => {
    expect(toApiError(exception)).toEqual({ statusCode, code, message: exception.message })
  })

  it('takes the message of an HttpException thrown with a bare string', () => {
    expect(toApiError(new HttpException('Just text', 400))?.message).toBe('Just text')
  })

  it('keeps the status of an error raised by Express middleware', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), { statusCode: 413 })

    expect(toApiError(tooLarge)).toEqual({ statusCode: 413, code: 'payload-too-large', message: 'request entity too large' })
  })

  it('does not vouch for a database failure other than a unique violation', () => {
    const notNull = new QueryFailedError('INSERT', [], Object.assign(new Error('null value'), { code: '23502' }))

    expect(toApiError(notNull)).toBeUndefined()
  })

  it.each([new Error('boom'), 'a thrown string', null, undefined])('does not vouch for %s', (thrown) => {
    expect(toApiError(thrown)).toBeUndefined()
  })
})

describe('toApiErrorFields', () => {
  it('gives one entry per failed constraint, with the path down to the property', () => {
    const fields = toApiErrorFields([
      { property: 'name', constraints: { isString: 'name must be a string', isNotEmpty: 'name should not be empty' } },
      {
        property: 'dataSources',
        children: [{
          property: '2',
          children: [{ property: 'url', constraints: { isUrl: 'url must be a URL address' } }],
        }],
      },
    ])

    expect(fields).toEqual([
      { path: 'name', message: 'name must be a string' },
      { path: 'name', message: 'name should not be empty' },
      { path: 'dataSources.2.url', message: 'url must be a URL address' },
    ])
  })
})
