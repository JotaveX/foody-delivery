import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Address } from '@/shared/types/user'
import type { AddressInput } from '@/features/address'
import { storeSession, user as fixtureUser } from '@/test/fixtures'
import { orderDetail, products } from '@/test/orderFixtures'
import { renderApp } from '@/test/renderApp'
import { server } from '@/test/server'

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

function mockApi(initialAddresses: Address[] = [home, work]) {
  const addresses = [...initialAddresses]
  const posted: Record<string, unknown>[] = []
  const postedAddresses: Record<string, unknown>[] = []
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
    http.post('/api/addresses', async ({ request }) => {
      const body = (await request.json()) as {
        address: AddressInput
        makeDefault: boolean
      }
      postedAddresses.push(body)
      const isDefault = body.makeDefault || addresses.length === 0
      if (isDefault) addresses.forEach((a, i) => (addresses[i] = { ...a, isDefault: false }))
      const created: Address = {
        ...body.address,
        label: body.address.label ?? null,
        complement: body.address.complement ?? null,
        id: 10 + addresses.length,
        isDefault,
      }
      addresses.push(created)
      return HttpResponse.json(created, { status: 201 })
    }),
  )
  return { posted, postedAddresses, calls }
}

type User = ReturnType<typeof renderApp>['user']

/** Two X-Burguer from the catalog: each click on the card adds one. */
async function fillOneItem(user: User) {
  const add = await screen.findByRole('button', { name: 'Adicionar X-Burguer' })
  await user.click(add)
  await user.click(add)
}

/** Items in the cart, then on to the delivery step. */
async function goToDelivery(user: User) {
  await fillOneItem(user)
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  await screen.findByRole('heading', { name: 'Entrega' })
}

/** The ViaCEP stub plus the CEP and number typed into the new address form. */
async function typeNewAddress(user: User) {
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
  await user.type(screen.getByLabelText('CEP'), '01426001')
  await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Rua Oscar Freire'))
  await user.type(screen.getByLabelText('Número'), '42')
}

const oscarFreire = {
  zipCode: '01426001',
  street: 'Rua Oscar Freire',
  number: '42',
  neighborhood: 'Jardins',
  city: 'São Paulo',
  state: 'SP',
}

const total = () => screen.getByTestId('order-total')
const submit = () => screen.getByRole('button', { name: 'Criar pedido' })
const currentStep = () =>
  within(screen.getByRole('list', { name: 'Etapas do pedido' }))
    .getAllByRole('listitem')
    .find((step) => step.getAttribute('aria-current') === 'step')
const ticket = () => screen.getByRole('complementary', { name: 'Seu pedido' })

describe('NewOrderPage', () => {
  beforeEach(() => storeSession())

  it('starts on the menu and moves to the delivery step with the cart kept', async () => {
    mockApi()
    const { user } = renderApp('/orders/new')

    expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
    expect(currentStep()).toHaveTextContent('01 Cardápio')
    // Customer and address belong to the next step.
    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar pedido' })).not.toBeInTheDocument()

    await goToDelivery(user)
    expect(screen.getByRole('heading', { name: 'Entrega' })).toHaveFocus()
    expect(currentStep()).toHaveTextContent('02 Entrega')
    expect(screen.queryByRole('region', { name: 'Cardápio' })).not.toBeInTheDocument()
    expect(total()).toHaveTextContent(/R\$\s49,80/)

    await user.click(screen.getByRole('button', { name: '← Voltar ao cardápio' }))
    expect(await screen.findByRole('heading', { name: 'Cardápio' })).toHaveFocus()
    expect(screen.getByLabelText('Quantidade de X-Burguer')).toHaveTextContent('2')
  })

  it('prefills the customer name and the default address', async () => {
    mockApi()
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    const homeOption = screen.getByRole('radio', { name: /^Casa/ })
    expect(homeOption).toBeChecked()
    expect(homeOption.closest('label')).toHaveTextContent(
      'CasaPadrãoAvenida Paulista, 1000Bela Vista, São Paulo/SP · CEP 01310-100',
    )
    expect(screen.getByRole('radio', { name: /^Trabalho/ })).not.toBeChecked()
    expect(screen.getByLabelText('Cliente')).toHaveValue('Maria Silva')
    // No address form until the user chooses to register a new one.
    expect(screen.queryByLabelText('Rua')).not.toBeInTheDocument()
  })

  it('opens the delivery step without items on the menu', async () => {
    mockApi()
    renderApp('/orders/new?etapa=entrega')

    expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Entrega' })).not.toBeInTheDocument()
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

  it('adds one unit per click on the product card, without steppers on the card', async () => {
    mockApi()
    const { user } = renderApp('/orders/new')
    const card = await screen.findByRole('listitem', { name: 'X-Burguer' })

    expect(total()).toHaveTextContent(/R\$\s0,00/)
    expect(within(card).getAllByRole('button')).toHaveLength(1)
    expect(within(card).queryByText('2x')).not.toBeInTheDocument()

    await fillOneItem(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar Refrigerante Lata' }))
    expect(card).toHaveTextContent('2x no pedido')
    expect(total()).toHaveTextContent(/R\$\s56,70/)

    const cart = within(screen.getByRole('list', { name: 'Itens do pedido' }))
    expect(cart.getByRole('listitem', { name: 'X-Burguer' })).toHaveTextContent(
      /2x X-Burguer\s*49,80\s*un\. R\$\s24,90/,
    )
    expect(cart.getByRole('listitem', { name: 'Refrigerante Lata' })).toHaveTextContent(
      /1x Refrigerante Lata\s*6,90/,
    )
  })

  it('changes and removes items on the ticket', async () => {
    mockApi()
    const { user } = renderApp('/orders/new')
    await fillOneItem(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar Refrigerante Lata' }))

    await user.click(screen.getByRole('button', { name: 'Aumentar Refrigerante Lata' }))
    expect(screen.getByLabelText('Quantidade de Refrigerante Lata')).toHaveTextContent('2')
    expect(total()).toHaveTextContent(/R\$\s63,60/)

    await user.click(screen.getByRole('button', { name: 'Diminuir X-Burguer' }))
    expect(total()).toHaveTextContent(/R\$\s38,70/)
    // At one unit the minus becomes "remove".
    expect(screen.queryByRole('button', { name: 'Diminuir X-Burguer' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remover X-Burguer' }))

    const cart = within(screen.getByRole('list', { name: 'Itens do pedido' }))
    expect(cart.queryByRole('listitem', { name: 'X-Burguer' })).not.toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'X-Burguer' })).not.toHaveTextContent('no pedido')
    expect(total()).toHaveTextContent(/R\$\s13,80/)
  })

  it('shows the ticket only while it has items, playing the exit before hiding it', async () => {
    mockApi()
    const { user } = renderApp('/orders/new')
    await screen.findByRole('listitem', { name: 'X-Burguer' })

    expect(ticket()).toHaveAttribute('data-presence', 'closed')
    await user.click(screen.getByRole('button', { name: 'Adicionar X-Burguer' }))
    expect(ticket()).toHaveAttribute('data-presence', 'open')

    await user.click(screen.getByRole('button', { name: 'Remover X-Burguer' }))
    expect(ticket()).toHaveAttribute('data-presence', 'leaving')
    fireEvent.animationEnd(ticket())
    expect(ticket()).toHaveAttribute('data-presence', 'closed')

    // Adding again during or after the exit brings it back.
    await user.click(screen.getByRole('button', { name: 'Adicionar X-Burguer' }))
    expect(ticket()).toHaveAttribute('data-presence', 'open')
  })

  it('goes back to the menu when the last item is removed on the delivery step', async () => {
    mockApi()
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    await user.click(screen.getByRole('button', { name: 'Diminuir X-Burguer' }))
    await user.click(screen.getByRole('button', { name: 'Remover X-Burguer' }))

    expect(await screen.findByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
    // Adding again stays on the menu: the step was reset, not just hidden.
    await user.click(screen.getByRole('button', { name: 'Adicionar X-Burguer' }))
    expect(screen.getByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
  })

  it('does not move on or send an order without items', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')
    await screen.findByRole('listitem', { name: 'X-Burguer' })

    const next = screen.getByRole('button', { name: 'Continuar' })
    expect(next).toBeDisabled()
    expect(screen.getByText('Adicione ao menos um item para continuar.')).toBeInTheDocument()
    await user.click(next)
    expect(screen.getByRole('heading', { name: 'Cardápio' })).toBeInTheDocument()
    expect(api.posted).toEqual([])

    await fillOneItem(user)
    expect(next).toBeEnabled()
    expect(screen.queryByText('Adicione ao menos um item para continuar.')).not.toBeInTheDocument()
  })

  it('sends the addressId of the chosen saved address and goes back to the list', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    await user.click(screen.getByRole('radio', { name: /^Trabalho/ }))
    await user.clear(screen.getByLabelText('Cliente'))
    await user.type(screen.getByLabelText('Cliente'), 'João')
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

  it('saves a new address with its button and delivers the order there', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    await user.click(screen.getByRole('radio', { name: /Cadastrar novo endereço/ }))
    expect(screen.getByRole('group', { name: 'Novo endereço' })).toBeInTheDocument()
    // Only the address is validated by the save button.
    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))
    expect(await screen.findByText('Informe a rua.')).toBeInTheDocument()
    expect(api.postedAddresses).toEqual([])

    await typeNewAddress(user)
    await user.type(screen.getByLabelText('Apelido do endereço (opcional)'), 'Academia')
    const meCallsBefore = api.calls.me
    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))

    const saved = await screen.findByRole('radio', { name: /^Academia/ })
    expect(saved).toBeChecked()
    expect(screen.queryByRole('group', { name: 'Novo endereço' })).not.toBeInTheDocument()
    expect(api.postedAddresses).toEqual([
      { address: { ...oscarFreire, label: 'Academia' }, makeDefault: false },
    ])
    // Not the default: the user does not need refreshing.
    expect(api.calls.me).toBe(meCallsBefore)
    await waitFor(() => expect(api.calls.addresses).toBe(2))

    await user.click(submit())
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    // Saved already: no warning, the order points to it.
    expect(api.posted).toEqual([
      { customerName: 'Maria Silva', items: [{ productId: 1, quantity: 2 }], addressId: 12 },
    ])
  })

  it('makes the saved address the default when asked, refreshing the user', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    await user.click(screen.getByRole('radio', { name: /Cadastrar novo endereço/ }))
    await typeNewAddress(user)
    await user.click(screen.getByLabelText('Usar como meu endereço padrão'))
    const meCallsBefore = api.calls.me
    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))

    const saved = await screen.findByRole('radio', { name: /Rua Oscar Freire/ })
    expect(saved).toBeChecked()
    expect(saved.closest('label')).toHaveTextContent('Padrão')
    expect(screen.getByRole('radio', { name: /^Casa/ }).closest('label')).not.toHaveTextContent(
      'Padrão',
    )
    expect(api.postedAddresses).toEqual([{ address: oscarFreire, makeDefault: true }])
    await waitFor(() => expect(api.calls.me).toBeGreaterThan(meCallsBefore))
  })

  it('shows API errors when saving the address', async () => {
    mockApi()
    server.use(
      http.post('/api/addresses', () =>
        HttpResponse.json(
          {
            status: 400,
            detail: 'Dados inválidos.',
            errors: { 'address.number': 'Número inválido.' },
          },
          { status: 400 },
        ),
      ),
    )
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    await user.click(screen.getByRole('radio', { name: /Cadastrar novo endereço/ }))
    await typeNewAddress(user)
    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Dados inválidos.')
    expect(screen.getByText('Número inválido.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Cadastrar novo endereço/ })).toBeChecked()
  })

  it('warns about an unsaved new address and saves it with the order', async () => {
    const api = mockApi()
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    await user.click(screen.getByRole('radio', { name: /Cadastrar novo endereço/ }))
    await typeNewAddress(user)
    await user.click(screen.getByLabelText('Usar como meu endereço padrão'))
    await user.click(submit())

    const dialog = await screen.findByRole('alertdialog', { name: 'Endereço não salvo' })
    expect(dialog).toHaveTextContent('Você não salvou o novo endereço')
    // Reviewing closes the warning and sends nothing.
    await user.click(within(dialog).getByRole('button', { name: 'Revisar endereço' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua Oscar Freire')
    expect(api.posted).toEqual([])

    await user.click(submit())
    const meCallsBefore = api.calls.me
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Salvar e criar pedido',
      }),
    )

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(api.posted).toEqual([
      {
        customerName: 'Maria Silva',
        items: [{ productId: 1, quantity: 2 }],
        newAddress: oscarFreire,
        saveAsDefault: true,
      },
    ])
    expect(api.postedAddresses).toEqual([])
    expect(api.calls.me).toBeGreaterThan(meCallsBefore)
    // The address list was invalidated (and refetched while still mounted).
    expect(api.calls.addresses).toBe(2)
  })

  it('asks a user without addresses to register one', async () => {
    const api = mockApi([])
    server.use(http.get('https://viacep.com.br/ws/:cep/json/', () => HttpResponse.error()))
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    expect(screen.getByRole('group', { name: 'Novo endereço' })).toBeInTheDocument()
    expect(screen.getByText(/Você ainda não tem endereço cadastrado/)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Usar como meu endereço padrão')).not.toBeInTheDocument()

    await user.click(submit())
    expect(await screen.findByText('Informe a rua.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('CEP'), '01310100')
    await user.type(screen.getByLabelText('Rua'), 'Avenida Paulista')
    await user.type(screen.getByLabelText('Número'), '1000')
    await user.type(screen.getByLabelText('Bairro'), 'Bela Vista')
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo')
    await user.type(screen.getByLabelText('UF'), 'SP')
    await user.click(submit())
    await user.click(await screen.findByRole('button', { name: 'Salvar e criar pedido' }))

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(api.posted).toEqual([
      expect.objectContaining({
        newAddress: expect.objectContaining({ street: 'Avenida Paulista', zipCode: '01310100' }),
      }),
    ])
  })

  it('lets a user without addresses save the first one, which becomes the default', async () => {
    const api = mockApi([])
    const { user } = renderApp('/orders/new')
    await goToDelivery(user)

    await typeNewAddress(user)
    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))

    const saved = await screen.findByRole('radio', { name: /Rua Oscar Freire/ })
    expect(saved).toBeChecked()
    expect(saved.closest('label')).toHaveTextContent('Padrão')
    expect(api.postedAddresses).toEqual([{ address: oscarFreire, makeDefault: false }])
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
    await goToDelivery(user)

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
    await goToDelivery(user)

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
    await goToDelivery(user)

    await user.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro inesperado.')
    await user.click(submit())

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[1]).toBe(keys[0])
  })
})
