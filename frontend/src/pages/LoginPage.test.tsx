import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { user as fixtureUser } from '@/test/fixtures'
import { renderApp } from '@/test/renderApp'
import { server } from '@/test/server'

describe('LoginPage', () => {
  it('validates the fields before calling the API', async () => {
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('E-mail'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
  })

  it('signs in and redirects to the home page', async () => {
    let sentBody: unknown
    server.use(
      http.post('/api/auth/login', async ({ request }) => {
        sentBody = await request.json()
        return HttpResponse.json({
          token: 'jwt',
          expiresIn: 7200,
          refreshExpiresIn: 604800,
          user: fixtureUser,
        })
      }),
      http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)),
    )
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('E-mail'), 'maria@example.com')
    await user.type(screen.getByLabelText('Senha'), 's3nha-segura')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(sentBody).toEqual({ email: 'maria@example.com', password: 's3nha-segura' })
    expect(JSON.parse(localStorage.getItem('foody.session')!)).toMatchObject({ token: 'jwt' })
  })

  it('shows the ProblemDetail message returned by the API', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { status: 401, title: 'Unauthorized', detail: 'E-mail ou senha inválidos.' },
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('E-mail'), 'maria@example.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-errada')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.getByRole('heading', { name: 'Identifique-se' })).toBeInTheDocument()
  })
})
