import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { storeSession, user } from '../test/fixtures'
import { server } from '../test/server'
import { api, LOGIN_PATH, setUnauthorizedHandler } from './client'

const refreshed = (token: string) =>
  HttpResponse.json({ token, expiresIn: 7200, refreshExpiresIn: 604800, user })

const storedToken = () => JSON.parse(localStorage.getItem('foody.session')!).token

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

  it('refreshes an expired token before sending the request', async () => {
    let refreshes = 0
    server.use(
      http.post('/api/auth/refresh', () => {
        refreshes++
        return refreshed('fresh-token')
      }),
      http.get('/api/orders', ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('Authorization') }),
      ),
    )
    storeSession({ token: 'expired-token', expiresAt: Date.now() - 1000 })

    const responses = await Promise.all([api.get('/orders'), api.get('/orders')])

    expect(responses.map((r) => r.data.auth)).toEqual(['Bearer fresh-token', 'Bearer fresh-token'])
    // The refresh token is single-use: concurrent requests share one refresh.
    expect(refreshes).toBe(1)
    expect(storedToken()).toBe('fresh-token')
  })

  it('refreshes and retries once when the server rejects a token that looked valid', async () => {
    server.use(
      http.post('/api/auth/refresh', () => refreshed('fresh-token')),
      http.get('/api/orders', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh-token'
          ? HttpResponse.json({ ok: true })
          : unauthorized(),
      ),
    )
    storeSession({ token: 'rejected-token' })
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    const response = await api.get('/orders')

    expect(response.data).toEqual({ ok: true })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('ends the session when the refresh token is rejected too', async () => {
    // The default handler answers /auth/refresh with 401.
    server.use(http.get('/api/orders', unauthorized))
    storeSession({ token: 'revoked-token' })
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await expect(api.get('/orders')).rejects.toThrow()

    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(localStorage.getItem('foody.session')).toBeNull()
  })
})
