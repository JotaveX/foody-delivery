import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Address } from '../auth/types'
import { storeSession, user as fixtureUser } from '../test/fixtures'
import { orderDetail } from '../test/orderFixtures'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

const home: Address = { ...fixtureUser.defaultAddress!, id: 1 }
const work: Address = {
  id: 2,
  label: 'Trabalho',
  street: 'Rua Augusta',
  number: '500',
  complement: null,
  neighborhood: 'Consolação',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01305000',
  isDefault: false,
}

function mockApi(addresses: Address[] = [home, work]) {
  const posted: Record<string, unknown>[] = []
  const calls = { addresses: 0, me: 0, orders: 0 }
  server.use(
    http.get('/api/auth/me', () => {
      calls.me += 1
      return HttpResponse.json(fixtureUser)
    }),
    http.get('/api/addresses', () => {
      calls.addresses += 1
      return HttpResponse.json(addresses)
    }),
    http.get('/api/orders', () => {
      calls.orders += 1
      return HttpResponse.json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 })
    }),
    http.post('/api/orders', async ({ request }) => {
      posted.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(orderDetail(99, 'RECEBIDO'), { status: 201 })
    }),
  )
  return { posted, calls }
}

async function fillOneItem(user: ReturnType<typeof renderApp>['user']) {
  const row = screen.getByRole('listitem', { name: 'Item 1' })
  await user.type(within(row).getByLabelText('Item'), 'X-Burger')
  await user.clear(within(row).getByLabelText('Qtd.'))
  await user.type(within(row).getByLabelText('Qtd.'), '2')
  await user.type(within(row).getByLabelText('Preço (R$)'), '12.50')
}

describe('NewOrderPage', () => {
  beforeEach(() => storeSession())

  it('prefills the customer name and the default address', async () => {
    mockApi()
    renderApp('/orders/new')

    const homeOption = await screen.findByRole('radio', { name: /^Casa/ })
    expect(homeOption).toBeChecked()
    expect(homeOption.closest('label')).toHaveTextContent(
      'CasaPadrãoAvenida Paulista, 1000Bela Vista, São Paulo/SP · CEP 01310-100',
    )
    expect(screen.getByRole('radio', { name: /^Trabalho/ })).not.toBeChecked()
    expect(screen.getByLabelText('Cliente')).toHaveValue('Maria Silva')
    // No address form until the user chooses to register a new one.
    expect(screen.queryByLabelText('Rua')).not.toBeInTheDocument()
  })

  it('computes the total live and validates the items', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')
    await screen.findByRole('radio', { name: /^Casa/ })

    await fillOneItem(user)
    expect(screen.getByTestId('order-total')).toHaveTextContent(/R\$\s25,00/)

    await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
    const second = screen.getByRole('listitem', { name: 'Item 2' })
    await user.type(within(second).getByLabelText('Preço (R$)'), '8.9')
    expect(screen.getByTestId('order-total')).toHaveTextContent(/R\$\s33,90/)

    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))
    expect(await within(second).findByText('Informe o item.')).toBeInTheDocument()
    expect(api.posted).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Remover item 2' }))
    expect(screen.getByTestId('order-total')).toHaveTextContent(/R\$\s25,00/)
    expect(screen.getByRole('button', { name: 'Remover item 1' })).toBeDisabled()
  })

  it('sends the addressId of the chosen saved address and goes back to the list', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')

    await user.click(await screen.findByRole('radio', { name: /^Trabalho/ }))
    await user.clear(screen.getByLabelText('Cliente'))
    await user.type(screen.getByLabelText('Cliente'), 'João')
    await fillOneItem(user)
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(api.posted).toEqual([
      {
        customerName: 'João',
        items: [{ name: 'X-Burger', quantity: 2, unitPrice: 12.5 }],
        addressId: 2,
      },
    ])
    expect(api.calls.addresses).toBe(1)
  })

  it('sends newAddress when registering a new address, refreshing addresses and user', async () => {
    const api = mockApi()
    server.use(
      http.get('https://viacep.com.br/ws/:cep/json/', () =>
        HttpResponse.json({
          logradouro: 'Rua Oscar Freire',
          bairro: 'Jardins',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      ),
    )
    const { user } = renderApp('/orders/new')

    await user.click(await screen.findByRole('radio', { name: /Cadastrar novo endereço/ }))
    expect(screen.getByRole('group', { name: 'Novo endereço' })).toBeInTheDocument()
    expect(screen.getByLabelText('Rua')).toHaveValue('')
    await user.type(screen.getByLabelText('CEP'), '01426001')
    await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Rua Oscar Freire'))
    await user.type(screen.getByLabelText('Número'), '42')
    await user.click(screen.getByLabelText('Usar como meu endereço padrão'))
    await fillOneItem(user)
    const meCallsBefore = api.calls.me
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(api.posted).toEqual([
      {
        customerName: 'Maria Silva',
        items: [{ name: 'X-Burger', quantity: 2, unitPrice: 12.5 }],
        newAddress: {
          zipCode: '01426001',
          street: 'Rua Oscar Freire',
          number: '42',
          neighborhood: 'Jardins',
          city: 'São Paulo',
          state: 'SP',
        },
        saveAsDefault: true,
      },
    ])
    expect(api.calls.me).toBeGreaterThan(meCallsBefore)
    // The address list was invalidated (and refetched while still mounted).
    expect(api.calls.addresses).toBe(2)
  })

  it('asks a user without addresses to register one', async () => {
    const api = mockApi([])
    server.use(http.get('https://viacep.com.br/ws/:cep/json/', () => HttpResponse.error()))
    const { user } = renderApp('/orders/new')

    expect(await screen.findByRole('group', { name: 'Novo endereço' })).toBeInTheDocument()
    expect(screen.getByText(/Você ainda não tem endereço cadastrado/)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Usar como meu endereço padrão')).not.toBeInTheDocument()

    await fillOneItem(user)
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))
    expect(await screen.findByText('Informe a rua.')).toBeInTheDocument()
    expect(api.posted).toEqual([])

    await user.type(screen.getByLabelText('CEP'), '01310100')
    await user.type(screen.getByLabelText('Rua'), 'Avenida Paulista')
    await user.type(screen.getByLabelText('Número'), '1000')
    await user.type(screen.getByLabelText('Bairro'), 'Bela Vista')
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.type(screen.getByLabelText('UF'), 'SP')
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(api.posted).toEqual([
      expect.objectContaining({
        newAddress: expect.objectContaining({ street: 'Avenida Paulista', zipCode: '01310100' }),
      }),
    ])
  })

  it('shows API errors on the form', async () => {
    mockApi()
    server.use(
      http.post('/api/orders', () =>
        HttpResponse.json(
          {
            status: 422,
            detail: 'Endereço de entrega inválido: use um endereço ativo do seu perfil.',
            errors: { addressId: 'Endereço não encontrado.' },
          },
          { status: 422 },
        ),
      ),
    )
    const { user } = renderApp('/orders/new')
    await screen.findByRole('radio', { name: /^Casa/ })

    await fillOneItem(user)
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Endereço de entrega inválido')
    expect(screen.getByText('Endereço não encontrado.')).toBeInTheDocument()
  })
})
