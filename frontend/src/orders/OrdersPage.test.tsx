import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { storeSession, user as fixtureUser } from '../test/fixtures'
import { orderSummary, page } from '../test/orderFixtures'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'
import type { OrderStatus, OrderSummary } from './types'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

/** An order created `age` minutes ago whose status last changed `inStatus` minutes ago. */
function timedOrder(id: number, status: OrderStatus, age: number, inStatus = age): OrderSummary {
  return {
    ...orderSummary(id, status),
    createdAt: minutesAgo(age),
    updatedAt: minutesAgo(inStatus),
  }
}

const column = (name: string) => within(screen.getByRole('region', { name }))
const ticket = (id: number) => screen.getByRole('listitem', { name: `Pedido #${id}` })

/** Stateful order API filtered by status: PATCHes change what the next GETs return. */
function mockOrders(orders: OrderSummary[]) {
  const listRequests: URLSearchParams[] = []
  const patches: { id: number; status: string }[] = []
  server.use(
    http.get('/api/orders', ({ request }) => {
      const params = new URL(request.url).searchParams
      listRequests.push(params)
      const status = params.get('status')
      return HttpResponse.json(page(orders.filter((o) => !status || o.status === status)))
    }),
    http.patch('/api/orders/:id/status', async ({ params, request }) => {
      const { status } = (await request.json()) as { status: OrderStatus }
      patches.push({ id: Number(params.id), status })
      const order = orders.find((o) => o.id === Number(params.id))!
      order.status = status
      order.updatedAt = new Date().toISOString()
      return HttpResponse.json(order)
    }),
  )
  return { listRequests, patches }
}

describe('OrdersPage board', () => {
  beforeEach(() => {
    storeSession()
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
  })

  it('shows one column per open status with the tickets, oldest first', async () => {
    const api = mockOrders([
      timedOrder(1, 'RECEBIDO', 5),
      timedOrder(3, 'RECEBIDO', 20, 3),
      timedOrder(2, 'EM_PREPARO', 8),
      timedOrder(4, 'SAIU_PARA_ENTREGA', 30),
      timedOrder(5, 'CANCELADO', 30),
    ])
    renderApp('/orders')

    await screen.findByRole('listitem', { name: 'Pedido #1' })
    expect(
      column('Recebido')
        .getAllByRole('listitem', { name: /^Pedido/ })
        .map((li) => li.getAttribute('aria-label')),
    ).toEqual(['Pedido #3', 'Pedido #1'])
    expect(column('Em preparo').getByRole('listitem', { name: 'Pedido #2' })).toBeInTheDocument()
    expect(
      column('Saiu para entrega').getByRole('listitem', { name: 'Pedido #4' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: 'Pedido #5' })).not.toBeInTheDocument()
    expect(api.listRequests.map((p) => p.get('status')).sort()).toEqual([
      'EM_PREPARO',
      'ENTREGUE',
      'RECEBIDO',
      'SAIU_PARA_ENTREGA',
    ])

    const first = within(ticket(1))
    expect(first.getByRole('link', { name: '#1' })).toHaveAttribute('href', '/orders/1')
    expect(first.getByText('há 5 min')).toBeInTheDocument()
    expect(first.getByText('Cliente 1')).toBeInTheDocument()
    expect(first.getByText('Bela Vista')).toBeInTheDocument()
    expect(first.getAllByRole('listitem').map((li) => li.textContent?.replace(/\s/g, ' '))).toEqual(
      ['2x X-Burguer49,80', '1x Refrigerante Lata6,90'],
    )
    expect(first.getByText('TOTAL').parentElement).toHaveTextContent(/R\$\s56,70/)
  })

  it('flags tickets stalled in their status and counts them in the summary', async () => {
    mockOrders([timedOrder(1, 'RECEBIDO', 20, 14), timedOrder(2, 'EM_PREPARO', 6, 3)])
    renderApp('/orders')

    await screen.findByRole('listitem', { name: 'Pedido #1' })
    expect(ticket(1)).toHaveTextContent('PARADO HÁ 14 MIN')
    expect(ticket(2)).not.toHaveTextContent('PARADO')
    const summary = screen.getByRole('list', { name: 'Resumo' })
    expect(summary).toHaveTextContent('2 abertos')
    expect(summary).toHaveTextContent('1 pedido parado há mais de 10 min')
  })

  it("lists today's deliveries with their total time", async () => {
    mockOrders([
      timedOrder(1, 'ENTREGUE', 40, 12),
      timedOrder(2, 'ENTREGUE', 30, 10),
      { ...orderSummary(3, 'ENTREGUE'), createdAt: minutesAgo(3000), updatedAt: minutesAgo(2990) },
    ])
    renderApp('/orders')

    const delivered = within(await screen.findByRole('region', { name: 'Entregue hoje' }))
    expect(
      (await delivered.findAllByRole('link', { name: /^#/ })).map((a) => a.textContent),
    ).toEqual(['#1 Cliente 128 min', '#2 Cliente 220 min'])
    // No stalled order and no average: the summary only counts the open ones.
    expect(screen.getByRole('list', { name: 'Resumo' })).toHaveTextContent(/^0 abertos$/)
    expect(delivered.getByRole('link', { name: /Ver todos os entregues/ })).toHaveAttribute(
      'href',
      '/orders?view=lista&status=ENTREGUE',
    )
  })

  it('shows only the actions valid from the current status', async () => {
    mockOrders([
      timedOrder(1, 'RECEBIDO', 1),
      timedOrder(2, 'EM_PREPARO', 1),
      timedOrder(3, 'SAIU_PARA_ENTREGA', 1),
    ])
    renderApp('/orders')

    const names = async (id: number) =>
      within(await screen.findByRole('listitem', { name: `Pedido #${id}` }))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim())

    expect(await names(1)).toEqual(['Iniciar preparo →', 'Cancelar pedido #1'])
    expect(await names(2)).toEqual(['Saiu p/ entrega →', 'Cancelar pedido #2'])
    expect(await names(3)).toEqual(['Entregue →'])
  })

  it('moves the ticket to the next column after changing the status', async () => {
    const api = mockOrders([timedOrder(1, 'RECEBIDO', 4)])
    const { user } = renderApp('/orders')

    await user.click(
      within(await screen.findByRole('listitem', { name: 'Pedido #1' })).getByRole('button', {
        name: 'Iniciar preparo',
      }),
    )

    expect(
      await column('Em preparo').findByRole('listitem', { name: 'Pedido #1' }),
    ).toBeInTheDocument()
    expect(column('Recebido').queryByRole('listitem', { name: 'Pedido #1' })).toBeNull()
    expect(api.patches).toEqual([{ id: 1, status: 'EM_PREPARO' }])
  })

  it('asks for confirmation before cancelling', async () => {
    const api = mockOrders([timedOrder(1, 'RECEBIDO', 4)])
    const { user } = renderApp('/orders')

    const cancel = within(await screen.findByRole('listitem', { name: 'Pedido #1' })).getByRole(
      'button',
      { name: 'Cancelar pedido #1' },
    )
    await user.click(cancel)
    const dialog = screen.getByRole('alertdialog', { name: 'Cancelar o pedido #1?' })
    await user.click(within(dialog).getByRole('button', { name: 'Voltar' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(api.patches).toEqual([])

    await user.click(cancel)
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar pedido' }),
    )

    await expect
      .poll(() => screen.queryByRole('listitem', { name: 'Pedido #1' }))
      .not.toBeInTheDocument()
    expect(api.patches).toEqual([{ id: 1, status: 'CANCELADO' }])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows the 409 returned by the API', async () => {
    mockOrders([timedOrder(1, 'RECEBIDO', 4)])
    server.use(
      http.patch('/api/orders/:id/status', () =>
        HttpResponse.json(
          {
            status: 409,
            detail: 'Não é possível alterar o status de CANCELADO para EM_PREPARO.',
            currentStatus: 'CANCELADO',
            requestedStatus: 'EM_PREPARO',
          },
          { status: 409 },
        ),
      ),
    )
    const { user } = renderApp('/orders')

    await user.click(
      within(await screen.findByRole('listitem', { name: 'Pedido #1' })).getByRole('button', {
        name: 'Iniciar preparo',
      }),
    )

    expect(await within(ticket(1)).findByRole('alert')).toHaveTextContent(
      'Não é possível alterar o status de CANCELADO para EM_PREPARO.',
    )
  })

  it('shows an error state with retry', async () => {
    let failing = true
    server.use(
      http.get('/api/orders', ({ request }) => {
        const status = new URL(request.url).searchParams.get('status')
        return failing
          ? HttpResponse.json({ status: 500, detail: 'Erro inesperado.' }, { status: 500 })
          : HttpResponse.json(page(status === 'RECEBIDO' ? [timedOrder(1, 'RECEBIDO', 1)] : []))
      }),
    )
    const { user } = renderApp('/orders')

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro inesperado.')
    failing = false
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByRole('listitem', { name: 'Pedido #1' })).toBeInTheDocument()
  })
})

describe('OrdersPage list', () => {
  beforeEach(() => {
    storeSession()
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
  })

  it('switches between board and list', async () => {
    mockOrders([timedOrder(1, 'CANCELADO', 4)])
    const { user } = renderApp('/orders')

    const toggle = within(await screen.findByRole('group', { name: 'Modo de visualização' }))
    expect(toggle.getByRole('button', { name: 'Quadro' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('listitem', { name: 'Pedido #1' })).not.toBeInTheDocument()

    await user.click(toggle.getByRole('button', { name: 'Lista' }))

    expect(await screen.findByRole('listitem', { name: 'Pedido #1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lists every order with customer, address, items, total and status stamp', async () => {
    mockOrders([timedOrder(1, 'CANCELADO', 4)])
    renderApp('/orders?view=lista')

    const order = within(await screen.findByRole('listitem', { name: 'Pedido #1' }))
    expect(order.getByText('Cliente 1')).toBeInTheDocument()
    expect(order.getByText('Avenida Paulista, 1000 · Bela Vista, São Paulo/SP')).toBeInTheDocument()
    expect(
      within(order.getByRole('list', { name: 'Itens' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['2x X-Burguer', '1x Refrigerante Lata'])
    expect(order.getByText(/R\$\s56,70/)).toBeInTheDocument()
    expect(order.getByText('Cancelado')).toHaveClass('stamp', 'stamp-cancelado')
    expect(order.queryAllByRole('button')).toEqual([])
  })

  it('filters by status through the API and shows the empty state', async () => {
    const api = mockOrders([])
    const { user } = renderApp('/orders?view=lista')
    expect(await screen.findByText('Nenhum pedido ainda.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Status'), 'Em preparo')

    expect(await screen.findByText('Nenhum pedido com status "Em preparo".')).toBeInTheDocument()
    expect(api.listRequests.at(-1)?.get('status')).toBe('EM_PREPARO')
    expect(api.listRequests.at(-1)?.get('page')).toBe('0')
  })

  it('paginates', async () => {
    const requestedPages: string[] = []
    server.use(
      http.get('/api/orders', ({ request }) => {
        const pageNumber = Number(new URL(request.url).searchParams.get('page'))
        requestedPages.push(String(pageNumber))
        return HttpResponse.json(page([orderSummary(10 + pageNumber, 'RECEBIDO')], pageNumber, 2))
      }),
    )
    const { user } = renderApp('/orders?view=lista')

    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    expect(await screen.findByRole('listitem', { name: 'Pedido #11' })).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(requestedPages).toEqual(['0', '1'])
  })
})
