import { afterEach, beforeAll } from 'vitest'
import { api, startFakedApi } from './api/server'
import '@/styles/index.css'

beforeAll(() => startFakedApi())

// The tester iframe starts without the focus, and the browser provider gives it the focus (`window.focus()`) before
// the first click or key press. A window gaining the focus is what `usePolling` reloads on, so that first click would
// reload what the spec mounted and pull the very control it is about to press from under it.
beforeAll(() => window.focus())

afterEach(() => api.resetHandlers())
