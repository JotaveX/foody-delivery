import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { storeSession, user as fixtureUser } from '../test/fixtures'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

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

  it('end the session when the token expires while the app is open', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
    storeSession({ expiresAt: Date.now() + 300 })

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Identifique-se' })).toBeInTheDocument()
    expect(localStorage.getItem('foody.session')).toBeNull()
  })

  it('log out from the header', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
    storeSession()
    const { user } = renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Identifique-se' })).toBeInTheDocument()
    expect(localStorage.getItem('foody.session')).toBeNull()
  })
})
