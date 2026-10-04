import type { TestProject } from 'vitest/node'
import { startApi } from './environment/api.ts'
import { startDatabase } from './environment/database.ts'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Where the real API serves the built UI, with a trailing slash. */
    baseUrl: string
  }
}

export default async function setup(project: TestProject) {
  const database = await startDatabase()
  try {
    const api = await startApi(database.env)
    project.provide('baseUrl', api.baseUrl)
    return async () => {
      await api.stop()
      database.stop()
    }
  }
  catch (error) {
    database.stop()
    throw error
  }
}
