import type { OnModuleInit } from '@nestjs/common'
import type { MigrationInterface, QueryRunner } from 'typeorm'
import { Inject, Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { PGliteDriver } from 'typeorm-pglite'
import { describe, expect, it } from 'vitest'

class CreatesMarkerTable implements MigrationInterface {
  name = 'CreatesMarkerTable1700000000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "marker" ("id" integer NOT NULL)')
  }

  async down(): Promise<void> {}
}

/** Reads a table only `CreatesMarkerTable` creates, exactly as `PluginsService.onModuleInit` reads from the database today. */
@Injectable()
class ReadsMarkerTableOnInit implements OnModuleInit {
  readSucceeded = false

  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query('SELECT * FROM "marker"')
    this.readSucceeded = true
  }
}

function buildModule(migrationsRun: boolean) {
  @Module({
    imports: [
      TypeOrmModule.forRoot({
        type: 'postgres',
        driver: new PGliteDriver().driver,
        migrations: [CreatesMarkerTable],
        migrationsRun,
        synchronize: false,
      }),
    ],
    providers: [ReadsMarkerTableOnInit],
  })
  class FixtureModule {}
  return FixtureModule
}

describe('typeOrmModule.forRoot({ migrationsRun: true }) orders migrations before onModuleInit', () => {
  it('lets a provider\'s onModuleInit read a table only a migration created', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [buildModule(true)] }).compile()
    const app = moduleRef.createNestApplication({ logger: false })

    await app.init()

    expect(app.get(ReadsMarkerTableOnInit).readSucceeded).toBe(true)
    await app.close()
  })

  it('fails that same read when migrationsRun is off, proving the spec exercises the real ordering', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [buildModule(false)] }).compile()
    const app = moduleRef.createNestApplication({ logger: false })

    await expect(app.init()).rejects.toThrow(/marker/)

    await app.close()
  })
})
