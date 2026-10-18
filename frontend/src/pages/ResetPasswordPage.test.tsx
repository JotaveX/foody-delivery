import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

describe('ResetPasswordPage', () => {
  it('asks for a new link when the token is missing', () => {
    renderApp('/reset-password')

    expect(screen.getByRole('alert')).toHaveTextContent('Link de redefinição inválido')
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toBeInTheDocument()
  })

  it('validates the new password', async () => {
    const { user } = renderApp('/reset-password?token=abc')

    await user.type(screen.getByLabelText('Nova senha'), 'curta')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'outra')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByText('A senha deve ter no mínimo 8 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument()
  })

  it('sends the token with the new password and goes to the login page', async () => {
    let sentBody: unknown
    server.use(
      http.post('/api/auth/reset-password', async ({ request }) => {
        sentBody = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp('/reset-password?token=abc')

    await user.type(screen.getByLabelText('Nova senha'), 'nova-s3nha')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'nova-s3nha')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Senha redefinida.')
    expect(sentBody).toEqual({ token: 'abc', password: 'nova-s3nha' })
  })

  it('shows the API error for an expired link', async () => {
    server.use(
      http.post('/api/auth/reset-password', () =>
        HttpResponse.json(
          {
            status: 400,
            detail: 'Link de redefinição inválido ou expirado. Solicite um novo.',
          },
          { status: 400 },
        ),
      ),
    )
    const { user } = renderApp('/reset-password?token=abc')

    await user.type(screen.getByLabelText('Nova senha'), 'nova-s3nha')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'nova-s3nha')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('inválido ou expirado')
  })
})
