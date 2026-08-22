import type { DeepPartial, DeleteResult, FindManyOptions, FindOneOptions, FindOptionsWhere, InsertResult, ObjectLiteral, QueryDeepPartialEntity, RemoveOptions, Repository, SaveOptions, UpdateResult } from 'typeorm'
import type { Mock } from 'vitest'
import { vi } from 'vitest'

/**
 * A deliberately simplified view of `Repository<T>`'s methods: TypeORM overloads `create`,
 * `save`, and `remove` on single-entity vs. array arguments, which defeats `vi.fn()`'s
 * generic inference and makes `.mockImplementation()` unusable against the real overload
 * set. Every spec in this codebase mocks these against a single entity, so that's the only
 * shape modeled here.
 */
export interface MockRepository<T extends ObjectLiteral> {
  find: Mock<(options?: FindManyOptions<T>) => Promise<T[]>>
  findOne: Mock<(options: FindOneOptions<T>) => Promise<T | null>>
  findOneBy: Mock<(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]) => Promise<T | null>>
  findBy: Mock<(where: FindOptionsWhere<T> | FindOptionsWhere<T>[]) => Promise<T[]>>
  create: Mock<(entityLike?: DeepPartial<T>) => T>
  save: Mock<(entity: T, options?: SaveOptions) => Promise<T>>
  update: Mock<(criteria: FindOptionsWhere<T> | string | string[], partialEntity: QueryDeepPartialEntity<T>) => Promise<UpdateResult>>
  delete: Mock<(criteria: FindOptionsWhere<T> | string | string[]) => Promise<DeleteResult>>
  remove: Mock<(entity: T | T[], options?: RemoveOptions) => Promise<T | T[]>>
  insert: Mock<(entity: QueryDeepPartialEntity<T>) => Promise<InsertResult>>
  upsert: Mock<(entityOrEntities: QueryDeepPartialEntity<T>[], conflictPathsOrOptions: string[]) => Promise<InsertResult>>
  maximum: Mock<(columnName: keyof T & string, where?: FindOptionsWhere<T>) => Promise<number | null>>
  count: Mock<(options?: FindManyOptions<T>) => Promise<number>>
}

export function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    findBy: vi.fn(),
    create: vi.fn((input?: unknown) => input),
    save: vi.fn(async (input: unknown) => input),
    update: vi.fn(),
    delete: vi.fn(),
    remove: vi.fn(async (input: unknown) => input),
    insert: vi.fn(),
    upsert: vi.fn(),
    maximum: vi.fn(),
    count: vi.fn(),
  } as unknown as MockRepository<T>
}

/** The one documented boundary cast: a `MockRepository<T>` is a structural subset of `Repository<T>`, sufficient for constructor injection in tests. */
export function asRepository<T extends ObjectLiteral>(mock: MockRepository<T>): Repository<T> {
  return mock as unknown as Repository<T>
}

/** Pulls the `id` out of a `{ where: { id } }` find-options object, for specs whose mock `findOne`/`find` filters by id. Returns `undefined` for an array/absent `where`, which no spec in this codebase currently passes. */
export function whereId<T extends ObjectLiteral>(options: FindOneOptions<T> | FindManyOptions<T>): string | undefined {
  const where = options.where
  if (!where || Array.isArray(where))
    return undefined
  return (where as { id?: string }).id
}

/** A `MockRepository<T>` whose `.manager` supports the two `EntityManager` members this codebase's transactions actually use: getting a scoped repository, and running a callback "in" a transaction (here, just invoking it — there's no real DB to isolate). */
export interface MockTransactionalRepository<T extends ObjectLiteral> extends MockRepository<T> {
  manager: {
    getRepository: Mock<(target?: unknown) => MockTransactionalRepository<T>>
    transaction: Mock<(cb: (manager: MockTransactionalRepository<T>['manager']) => Promise<void>) => Promise<void>>
  }
}

export function createMockTransactionalRepository<T extends ObjectLiteral>(): MockTransactionalRepository<T> {
  const repo = createMockRepository<T>() as MockTransactionalRepository<T>
  repo.manager = {
    getRepository: vi.fn(() => repo),
    transaction: vi.fn(async cb => cb(repo.manager)),
  }
  return repo
}
