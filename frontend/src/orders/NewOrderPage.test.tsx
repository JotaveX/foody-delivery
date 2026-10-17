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

function mockApi() {
  const posted: Record<string, unknown>[] = []
  const calls = { addresses: 0, me: 0, orders: 0 }
  server.use(
    http.get('/api/auth/me', () => {
      calls.me += 1
      return HttpResponse.json(fixtureUser)
    }),
    http.get('/api/addresses', () => {
      calls.addresses += 1
      return HttpResponse.json([home, work])
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

    const select = await screen.findByLabelText('Endereço de entrega')
    expect(select).toHaveValue('1')
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Casa — Avenida Paulista, 1000 (padrão)',
    )
    expect(screen.getByLabelText('Cliente')).toHaveValue('Maria Silva')
    expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista')
    expect(screen.getByLabelText('Rua')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('CEP')).toHaveValue('01310-100')
    expect(screen.getByLabelText('Bairro')).toHaveValue('Bela Vista')
  })

  it('computes the total live and validates the items', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')
    await screen.findByLabelText('Endereço de entrega')

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

    await user.selectOptions(await screen.findByLabelText('Endereço de entrega'), '2')
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua Augusta')
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

  it('sends newAddress when using another address, refreshing addresses and user', async () => {
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

    await user.selectOptions(
      await screen.findByLabelText('Endereço de entrega'),
      'Usar outro endereço…',
    )
    expect(screen.getByLabelText('Rua')).toHaveValue('')
    expect(screen.getByLabelText('Rua')).not.toHaveAttribute('readonly')
    await user.type(screen.getByLabelText('CEP'), '01426001')
    await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Rua Oscar Freire'))
    await user.type(screen.getByLabelText('Número'), '42')
    await user.click(screen.getByLabelText('Definir como padrão'))
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
    await screen.findByLabelText('Endereço de entrega')

    await fillOneItem(user)
    await user.click(screen.getByRole('button', { name: 'Criar pedido' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Endereço de entrega inválido')
    expect(screen.getByText('Endereço não encontrado.')).toBeInTheDocument()
  })
})
