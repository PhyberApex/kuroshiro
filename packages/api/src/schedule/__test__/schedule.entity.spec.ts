import { getMetadataArgsStorage } from 'typeorm'
import { describe, expect, it } from 'vitest'
import { Schedule } from '../schedule.entity.js'

describe('schedule entity', () => {
  const screenRelation = getMetadataArgsStorage().relations.find(relation => relation.target === Schedule && relation.propertyName === 'screen')

  it('owns the join to its screen, so a screen carries at most one schedule', () => {
    const joinColumn = getMetadataArgsStorage().joinColumns.find(column => column.target === Schedule && column.propertyName === 'screen')

    expect(screenRelation?.relationType).toBe('one-to-one')
    expect(joinColumn).toBeDefined()
  })

  it('is cascade-deleted with its screen, so deleting a screen leaves no orphan schedule', () => {
    expect(screenRelation?.options.onDelete).toBe('CASCADE')
  })
})
