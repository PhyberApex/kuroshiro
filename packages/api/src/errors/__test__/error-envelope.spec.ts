import type { HttpTestApp } from '../../test/httpApp.js'
import { Body, ConflictException, Controller, Get, HttpStatus, Logger, NotFoundException, Patch, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { QueryFailedError } from 'typeorm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHttpTestApp } from '../../test/httpApp.js'
import { ApiException } from '../api.exception.js'

class SourceDto {
  @IsOptional()
  @IsString()
  url?: string
}

class ThingDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  note?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceDto)
  dataSources?: SourceDto[]
}

@Controller('things')
class ThingsController {
  @Post()
  create(@Body() dto: ThingDto) {
    return { name: dto.name }
  }

  @Patch()
  update(@Body() dto: ThingDto) {
    return { ownKeys: Object.keys(dto), sourceKeys: dto.dataSources?.map(source => Object.keys(source)) }
  }

  @Get('coded')
  coded() {
    throw new ApiException(HttpStatus.CONFLICT, 'conflict', 'That name is taken.', { name: 'kitchen' })
  }

  @Get('uncoded')
  uncoded() {
    throw new NotFoundException('Thing not found')
  }

  @Get('uncoded-list')
  uncodedList() {
    throw new ConflictException(['first reason', 'second reason'])
  }

  @Get('bug')
  bug() {
    throw new Error('secret detail')
  }

  @Get('unique')
  unique() {
    throw new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate key'), { code: '23505' }))
  }
}

describe('the admin API error envelope', () => {
  let http: HttpTestApp

  beforeAll(async () => {
    http = await createHttpTestApp({ controllers: [ThingsController] })
  })

  afterAll(async () => {
    await http.app.close()
  })

  it('refuses an unknown body field with 400 validation, naming the path', async () => {
    const response = await http.postJson('/api/things', { name: 'kitchen', colour: 'red' })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      statusCode: 400,
      code: 'validation',
      message: 'The request has invalid fields.',
      fields: [{ path: 'colour', message: 'property colour should not exist' }],
    })
  })

  it('reports a nested validation failure with a dotted path and the array index', async () => {
    const response = await http.postJson('/api/things', {
      dataSources: [{ url: 'http://a.test' }, { url: 'http://b.test' }, { url: 7 }],
    })

    expect((await response.json()).fields).toEqual([
      { path: 'dataSources.2.url', message: 'url must be a string' },
    ])
  })

  it('leaves no own property on the DTO for a field a PATCH omits', async () => {
    const response = await http.postJson('/api/things', { name: 'kitchen', dataSources: [{}] }, { method: 'PATCH' })

    expect(await response.json()).toEqual({ ownKeys: ['name', 'dataSources'], sourceKeys: [[]] })
  })

  it('answers an exception thrown with a code with that code, status and details', async () => {
    const response = await http.request('/api/things/coded')

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      statusCode: 409,
      code: 'conflict',
      message: 'That name is taken.',
      details: { name: 'kitchen' },
    })
  })

  it('answers an HttpException without a code with the generic code of its status', async () => {
    const response = await http.request('/api/things/uncoded')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ statusCode: 404, code: 'not-found', message: 'Thing not found' })
  })

  it('answers a message that was thrown as a list as one string', async () => {
    const response = await http.request('/api/things/uncoded-list')

    expect(await response.json()).toEqual({
      statusCode: 409,
      code: 'conflict',
      message: 'first reason; second reason',
    })
  })

  it('answers a route that does not exist in the envelope', async () => {
    const response = await http.request('/api/nowhere')

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ statusCode: 404, code: 'not-found' })
  })

  it('answers a body that is not JSON with 400 bad-request', async () => {
    const response = await http.request('/api/things', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ statusCode: 400, code: 'bad-request' })
  })

  it('answers an unhandled error with a generic 500 internal and logs its stack', async () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})

    const response = await http.request('/api/things/bug')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ statusCode: 500, code: 'internal', message: 'Internal server error' })
    expect(logged).toHaveBeenCalledWith('secret detail', expect.stringContaining('ThingsController.bug'))
    logged.mockRestore()
  })

  it('answers a unique violation no service caught with 409 conflict', async () => {
    const response = await http.request('/api/things/unique')

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      statusCode: 409,
      code: 'conflict',
      message: 'The request conflicts with a record that already exists.',
    })
  })
})
