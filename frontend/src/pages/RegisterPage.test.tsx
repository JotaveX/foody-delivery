import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { user as fixtureUser } from '../test/fixtures'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

const VIACEP = 'https://viacep.com.br/ws/:cep/json/'

describe('RegisterPage', () => {
  it('fills the address from the CEP', async () => {
    server.use(
      http.get(VIACEP, ({ params }) =>
        params.cep === '01310100'
          ? HttpResponse.json({
              cep: '01310-100',
              logradouro: 'Avenida Paulista',
              bairro: 'Bela Vista',
              localidade: 'São Paulo',
              uf: 'SP',
            })
          : HttpResponse.json({ erro: 'true' }),
      ),
    )
    const { user } = renderApp('/register')

    await user.type(screen.getByLabelText('CEP'), '01310-100')

    await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista'))
    expect(screen.getByLabelText('Bairro')).toHaveValue('Bela Vista')
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo')
    expect(screen.getByLabelText('UF')).toHaveValue('SP')
    expect(screen.getByLabelText('Número')).toHaveFocus()
  })

  it('keeps the form usable when ViaCEP is down', async () => {
    server.use(http.get(VIACEP, () => HttpResponse.error()))
    const { user } = renderApp('/register')

    await user.type(screen.getByLabelText('CEP'), '01310100')

    expect(
      await screen.findByText('CEP não encontrado. Preencha o endereço manualmente.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Rua')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('validates the account and address fields', async () => {
    const { user } = renderApp('/register')

    await user.type(screen.getByLabelText('Senha'), 'curta')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByText('Informe o nome.')).toBeInTheDocument()
    expect(screen.getByText('A senha deve ter no mínimo 8 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Informe um CEP com 8 dígitos.')).toBeInTheDocument()
    expect(screen.getByText('Informe a rua.')).toBeInTheDocument()
  })

  it('lets the user skip the address and add it later', async () => {
    let registered: unknown
    server.use(
      http.post('/api/auth/register', async ({ request }) => {
        registered = await request.json()
        return HttpResponse.json({ ...fixtureUser, defaultAddress: null }, { status: 201 })
      }),
      http.post('/api/auth/login', () =>
        HttpResponse.json({
          token: 'jwt',
          expiresIn: 7200,
          user: { ...fixtureUser, defaultAddress: null },
        }),
      ),
      http.get('/api/auth/me', () => HttpResponse.json({ ...fixtureUser, defaultAddress: null })),
    )
    const { user } = renderApp('/register')

    await user.type(screen.getByLabelText('Nome'), 'Maria Silva')
    await user.type(screen.getByLabelText('E-mail'), 'maria@example.com')
    await user.type(screen.getByLabelText('Senha'), 's3nha-segura')
    await user.type(screen.getByLabelText('Confirmar senha'), 's3nha-segura')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Informe a rua.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cadastrar endereço depois' }))
    expect(screen.queryByLabelText('Rua')).not.toBeInTheDocument()
    expect(screen.getByText(/quando fizer o primeiro pedido/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(registered).toEqual({
      name: 'Maria Silva',
      email: 'maria@example.com',
      password: 's3nha-segura',
    })
  })

  it('registers, signs in and shows API errors per field', async () => {
    server.use(
      http.get(VIACEP, () => HttpResponse.error()),
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { status: 409, detail: 'Este e-mail já está cadastrado.' },
          { status: 409 },
        ),
      ),
    )
    const { user } = renderApp('/register')

    await user.type(screen.getByLabelText('Nome'), 'Maria Silva')
    await user.type(screen.getByLabelText('E-mail'), 'maria@example.com')
    await user.type(screen.getByLabelText('Senha'), 's3nha-segura')
    await user.type(screen.getByLabelText('Confirmar senha'), 's3nha-segura')
    await user.type(screen.getByLabelText('CEP'), '01310100')
    await user.type(screen.getByLabelText('Rua'), 'Avenida Paulista')
    await user.type(screen.getByLabelText('Número'), '1000')
    await user.type(screen.getByLabelText('Bairro'), 'Bela Vista')
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.type(screen.getByLabelText('UF'), 'sp')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Este e-mail já está cadastrado.')

    let registered: unknown
    server.use(
      http.post('/api/auth/register', async ({ request }) => {
        registered = await request.json()
        return HttpResponse.json(fixtureUser, { status: 201 })
      }),
      http.post('/api/auth/login', () =>
        HttpResponse.json({ token: 'jwt', expiresIn: 7200, user: fixtureUser }),
      ),
      http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)),
    )
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(registered).toMatchObject({
      name: 'Maria Silva',
      email: 'maria@example.com',
      address: { zipCode: '01310100', state: 'SP', street: 'Avenida Paulista' },
    })
    expect(registered).not.toHaveProperty('confirmPassword')
  })
})
