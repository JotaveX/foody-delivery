import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { storeSession, user as fixtureUser } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { server } from '@/test/server'

describe('protected routes', () => {
  it('redirect to /login when there is no token', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Identifique-se' })).toBeInTheDocument()
  })

  it('render the layout with the user name for a stored session', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
    storeSession()

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('clear the session and redirect when the API rejects the token', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ status: 401, detail: 'Token inválido ou expirado.' }, { status: 401 }),
      ),
    )
    storeSession({ token: 'revoked-token' })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Identifique-se' })).toBeInTheDocument()
    expect(localStorage.getItem('foody.session')).toBeNull()
  })

  it('renew an expired access token with the refresh cookie instead of logging out', async () => {
    server.use(
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({
          token: 'fresh-token',
          expiresIn: 7200,
          refreshExpiresIn: 604800,
          user: fixtureUser,
        }),
      ),
      http.get('/api/auth/me', ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh-token'
          ? HttpResponse.json(fixtureUser)
          : HttpResponse.json({ status: 401 }, { status: 401 }),
      ),
    )
    storeSession({ token: 'expired-token', expiresAt: Date.now() - 1000 })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('foody.session')!)).toMatchObject({
        token: 'fresh-token',
      }),
    )
  })

  it('end the session when the refresh token expires while the app is open', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
    storeSession({ refreshExpiresAt: Date.now() + 300 })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Identifique-se' })).toBeInTheDocument()
    expect(localStorage.getItem('foody.session')).toBeNull()
  })

  it('log out from the header, revoking the refresh token', async () => {
    let loggedOut = false
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)),
      http.post('/api/auth/logout', () => {
        loggedOut = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    storeSession()
    const { user } = renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Identifique-se' })).toBeInTheDocument()
    expect(localStorage.getItem('foody.session')).toBeNull()
    await waitFor(() => expect(loggedOut).toBe(true))
  })
})
