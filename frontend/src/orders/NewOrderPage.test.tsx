import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Address } from '../auth/types'
import { storeSession, user as fixtureUser } from '../test/fixtures'
import { orderDetail, products } from '../test/orderFixtures'
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
  const calls = { addresses: 0, me: 0, orders: 0, products: 0 }
  server.use(
    http.get('/api/products', () => {
      calls.products += 1
      return HttpResponse.json(products)
    }),
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

type User = ReturnType<typeof renderApp>['user']

/** Two X-Burguer from the catalog. */
async function fillOneItem(user: User) {
  const add = await screen.findByRole('button', { name: 'Adicionar X-Burguer' })
  await user.click(add)
  await user.click(add)
}

const total = () => screen.getByTestId('order-total')
const submit = () => screen.getByRole('button', { name: 'Criar pedido' })

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

  it('shows the catalog grouped by category and filters it with the chips', async () => {
    mockApi()
    const { user } = renderApp('/orders/new')

    const menu = within(await screen.findByRole('region', { name: 'Cardápio' }))
    expect(await menu.findByRole('region', { name: 'Lanches' })).toBeInTheDocument()
    expect(
      within(menu.getByRole('region', { name: 'Lanches' }))
        .getAllByRole('listitem')
        .map((card) => card.getAttribute('aria-label')),
    ).toEqual(['X-Burguer', 'Batata frita'])
    expect(menu.getByRole('region', { name: 'Pizza' })).toBeInTheDocument()
    expect(menu.getByRole('region', { name: 'Sobremesas e bebidas' })).toBeInTheDocument()
    // Only categories that have products get a chip.
    const chips = within(menu.getByRole('group', { name: 'Categorias' }))
    expect(chips.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Todos',
      'Lanches',
      'Pizza',
      'Sobremesas e bebidas',
    ])

    const card = menu.getByRole('listitem', { name: 'Pizza de Calabresa' })
    expect(card).toHaveTextContent('Grande, 8 fatias: calabresa, cebola, mussarela e azeitonas.')
    expect(card).toHaveTextContent(/R\$\s54,90/)
    const image = card.querySelector('img')!
    expect(image).toHaveAttribute('src', expect.stringContaining('catalog/pizza-calabresa.webp'))
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(image).toHaveAttribute('width', '320')
    expect(image).toHaveAttribute('height', '240')

    await user.click(chips.getByRole('button', { name: 'Pizza' }))
    expect(chips.getByRole('button', { name: 'Pizza' })).toHaveAttribute('aria-pressed', 'true')
    expect(menu.getByRole('region', { name: 'Pizza' })).toBeInTheDocument()
    expect(menu.queryByRole('region', { name: 'Lanches' })).not.toBeInTheDocument()
    expect(menu.queryByRole('listitem', { name: 'X-Burguer' })).not.toBeInTheDocument()

    await user.click(chips.getByRole('button', { name: 'Todos' }))
    expect(menu.getByRole('region', { name: 'Lanches' })).toBeInTheDocument()
  })

  it('shows a placeholder when a product image fails to load', async () => {
    mockApi()
    renderApp('/orders/new')

    const card = await screen.findByRole('listitem', { name: 'X-Burguer' })
    fireEvent.error(card.querySelector('img')!)

    expect(card.querySelector('img')).toBeNull()
    expect(card.querySelector('.product-image-placeholder')).toHaveStyle({
      width: '320px',
      height: '240px',
    })
  })

  it('updates quantities, subtotals and the total with + and −', async () => {
    mockApi()
    const { user } = renderApp('/orders/new')
    await screen.findByRole('listitem', { name: 'X-Burguer' })

    expect(total()).toHaveTextContent(/R\$\s0,00/)
    expect(screen.getByRole('button', { name: 'Diminuir X-Burguer' })).toBeDisabled()

    await fillOneItem(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar Refrigerante Lata' }))
    expect(screen.getByLabelText('Quantidade de X-Burguer')).toHaveTextContent('2')
    expect(total()).toHaveTextContent(/R\$\s56,70/)

    const cart = within(screen.getByRole('list', { name: 'Itens do pedido' }))
    expect(cart.getByRole('listitem', { name: 'X-Burguer' })).toHaveTextContent(
      /2× X-Burguer\s*R\$\s49,80\s*R\$\s24,90 cada/,
    )
    expect(cart.getByRole('listitem', { name: 'Refrigerante Lata' })).toHaveTextContent(
      /1× Refrigerante Lata\s*R\$\s6,90/,
    )

    await user.click(screen.getByRole('button', { name: 'Diminuir X-Burguer' }))
    expect(total()).toHaveTextContent(/R\$\s31,80/)
    await user.click(screen.getByRole('button', { name: 'Diminuir Refrigerante Lata' }))
    expect(cart.queryByRole('listitem', { name: 'Refrigerante Lata' })).not.toBeInTheDocument()
    expect(total()).toHaveTextContent(/R\$\s24,90/)
  })

  it('does not send an order without items', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')
    await screen.findByRole('listitem', { name: 'X-Burguer' })

    expect(submit()).toBeDisabled()
    expect(screen.getByText('Adicione ao menos um item para criar o pedido.')).toBeInTheDocument()
    // A disabled submit button also blocks implicit submission with Enter.
    await user.type(screen.getByLabelText('Cliente'), '{Enter}')
    await user.click(submit())
    expect(screen.getByRole('heading', { name: 'Novo pedido' })).toBeInTheDocument()
    expect(api.posted).toEqual([])

    await fillOneItem(user)
    expect(submit()).toBeEnabled()
    expect(
      screen.queryByText('Adicione ao menos um item para criar o pedido.'),
    ).not.toBeInTheDocument()
  })

  it('sends the addressId of the chosen saved address and goes back to the list', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')

    await user.click(await screen.findByRole('radio', { name: /^Trabalho/ }))
    await user.clear(screen.getByLabelText('Cliente'))
    await user.type(screen.getByLabelText('Cliente'), 'João')
    await fillOneItem(user)
    await user.click(submit())

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(api.posted).toEqual([
      {
        customerName: 'João',
        // Only productId and quantity: never a price.
        items: [{ productId: 1, quantity: 2 }],
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
    await user.click(submit())

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(api.posted).toEqual([
      {
        customerName: 'Maria Silva',
        items: [{ productId: 1, quantity: 2 }],
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
    await user.click(submit())
    expect(await screen.findByText('Informe a rua.')).toBeInTheDocument()
    expect(api.posted).toEqual([])

    await user.type(screen.getByLabelText('CEP'), '01310100')
    await user.type(screen.getByLabelText('Rua'), 'Avenida Paulista')
    await user.type(screen.getByLabelText('Número'), '1000')
    await user.type(screen.getByLabelText('Bairro'), 'Bela Vista')
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.type(screen.getByLabelText('UF'), 'SP')
    await user.click(submit())

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
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('Endereço de entrega inválido')
    expect(screen.getByText('Endereço não encontrado.')).toBeInTheDocument()
  })

  it('reloads the catalog when a product became unavailable', async () => {
    const api = mockApi()
    server.use(
      http.post('/api/orders', () =>
        HttpResponse.json(
          {
            status: 422,
            detail: 'Há produtos indisponíveis no pedido. Atualize o cardápio e tente novamente.',
            productIds: [1],
            errors: { items: 'Produto indisponível.' },
          },
          { status: 422 },
        ),
      ),
    )
    const { user } = renderApp('/orders/new')
    await screen.findByRole('radio', { name: /^Casa/ })

    await fillOneItem(user)
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('Há produtos indisponíveis')
    expect(screen.getByText('Produto indisponível.')).toBeInTheDocument()
    await waitFor(() => expect(api.calls.products).toBe(2))
  })

  it('reuses the same Idempotency-Key when the submit is retried', async () => {
    mockApi()
    const keys: (string | null)[] = []
    server.use(
      http.post('/api/orders', ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'))
        return keys.length === 1
          ? HttpResponse.json({ status: 500, detail: 'Erro inesperado.' }, { status: 500 })
          : HttpResponse.json(orderDetail(99, 'RECEBIDO'), { status: 201 })
      }),
    )
    const { user } = renderApp('/orders/new')
    await screen.findByRole('radio', { name: /^Casa/ })

    await fillOneItem(user)
    await user.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro inesperado.')
    await user.click(submit())

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[1]).toBe(keys[0])
  })
})
