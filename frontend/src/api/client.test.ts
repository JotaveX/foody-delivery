import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import { api, LOGIN_PATH, setUnauthorizedHandler } from './client'

const unauthorized = () =>
  HttpResponse.json({ status: 401, detail: 'Não autenticado.' }, { status: 401 })

describe('api client', () => {
  afterEach(() => setUnauthorizedHandler(null))

  it('ends the session on a 401 even when no token was left to send', async () => {
    // e.g. the stored session expired (readSession dropped it) or another tab logged out.
    server.use(http.get('/api/orders', unauthorized))
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await expect(api.get('/orders')).rejects.toThrow()

    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('treats a 401 from the login form as bad credentials, not as a lost session', async () => {
    server.use(http.post(`/api${LOGIN_PATH}`, unauthorized))
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await expect(api.post(LOGIN_PATH, { email: 'a@b.c', password: 'x' })).rejects.toThrow()

    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
