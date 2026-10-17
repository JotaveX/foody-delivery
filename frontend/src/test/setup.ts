import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { FakeStompClient } from './fakeStomp'
import { server } from './server'

vi.mock('@stomp/stompjs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@stomp/stompjs')>()),
  Client: (await import('./fakeStomp')).FakeStompClient,
}))

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  localStorage.clear()
  FakeStompClient.instances = []
})
afterAll(() => server.close())
