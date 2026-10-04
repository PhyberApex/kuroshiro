import { afterEach, beforeAll } from 'vitest'
import { api, startFakedApi } from './api/server'
import '@/styles/index.css'

beforeAll(() => startFakedApi())

afterEach(() => api.resetHandlers())
