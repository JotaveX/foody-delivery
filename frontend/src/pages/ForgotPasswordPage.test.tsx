import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/renderApp'
import { server } from '@/test/server'

describe('ForgotPasswordPage', () => {
  it('is reachable from the login page', async () => {
    const { user } = renderApp('/login')

    await user.click(screen.getByRole('link', { name: 'Esqueceu a senha?' }))

    expect(await screen.findByRole('heading', { name: 'Esqueci a senha' })).toBeInTheDocument()
  })

  it('validates the e-mail before calling the API', async () => {
    const { user } = renderApp('/forgot-password')

    await user.type(screen.getByLabelText('E-mail'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
  })

  it('requests the link and shows a message that does not reveal the account', async () => {
    let sentBody: unknown
    server.use(
      http.post('/api/auth/forgot-password', async ({ request }) => {
        sentBody = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp('/forgot-password')

    await user.type(screen.getByLabelText('E-mail'), ' maria@example.com ')
    await user.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se houver uma conta com esse e-mail',
    )
    expect(sentBody).toEqual({ email: 'maria@example.com' })
    expect(screen.queryByRole('button', { name: 'Enviar link' })).not.toBeInTheDocument()
  })

  it('shows the ProblemDetail message returned by the API', async () => {
    server.use(
      http.post('/api/auth/forgot-password', () =>
        HttpResponse.json(
          { status: 429, detail: 'Muitas requisições. Tente novamente em instantes.' },
          { status: 429 },
        ),
      ),
    )
    const { user } = renderApp('/forgot-password')

    await user.type(screen.getByLabelText('E-mail'), 'maria@example.com')
    await user.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas requisições')
  })
})
