import { act, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { FakeStompClient } from '../test/fakeStomp'
import { storeSession, user as fixtureUser } from '../test/fixtures'
import { orderDetail, orderSummary, page } from '../test/orderFixtures'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'
import type { OrderSummary } from './types'
import { ORDERS_TOPIC } from './useOrderUpdates'

const card = (id: number) => screen.getByRole('listitem', { name: `Pedido #${id}` })
const buttonNames = (id: number) =>
  within(card(id))
    .queryAllByRole('button')
    .map((b) => b.textContent)

/** Stateful order API: PATCHes change the list returned by the next GET. */
function mockOrders(orders: OrderSummary[]) {
  const listRequests: URLSearchParams[] = []
  const patches: { id: number; status: string }[] = []
  server.use(
    http.get('/api/orders', ({ request }) => {
      listRequests.push(new URL(request.url).searchParams)
      return HttpResponse.json(page(orders))
    }),
    http.patch('/api/orders/:id/status', async ({ params, request }) => {
      const { status } = (await request.json()) as { status: OrderSummary['status'] }
      patches.push({ id: Number(params.id), status })
      const order = orders.find((o) => o.id === Number(params.id))!
      order.status = status
      return HttpResponse.json(order)
    }),
  )
  return { listRequests, patches }
}

describe('OrdersPage', () => {
  beforeEach(() => {
    storeSession()
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
  })

  it('lists orders with customer, address, total, date and status badge', async () => {
    mockOrders([orderSummary(1, 'RECEBIDO')])
    renderApp('/orders')

    const order = await screen.findByRole('listitem', { name: 'Pedido #1' })
    expect(within(order).getByText('Cliente 1')).toBeInTheDocument()
    expect(
      within(order).getByText('Avenida Paulista, 1000 · Bela Vista, São Paulo/SP'),
    ).toBeInTheDocument()
    expect(within(order).getByText(/R\$\s56,70/)).toBeInTheDocument()
    expect(within(order).getByText(/2 itens · 17\/10\/2026/)).toBeInTheDocument()
    const thumbnails = within(within(order).getByRole('list', { name: 'Itens' })).getAllByRole(
      'img',
    )
    expect(thumbnails.map((img) => img.getAttribute('alt'))).toEqual([
      '2× X-Burguer',
      '1× Refrigerante Lata',
    ])
    expect(thumbnails[0]).toHaveAttribute('loading', 'lazy')
    expect(within(order).getByText('Recebido')).toHaveClass('status-badge', 'status-recebido')
  })

  it('shows only the buttons for transitions valid from the current status', async () => {
    mockOrders([
      orderSummary(1, 'RECEBIDO'),
      orderSummary(2, 'EM_PREPARO'),
      orderSummary(3, 'SAIU_PARA_ENTREGA'),
      orderSummary(4, 'ENTREGUE'),
      orderSummary(5, 'CANCELADO'),
    ])
    renderApp('/orders')
    await screen.findByRole('listitem', { name: 'Pedido #1' })

    expect(buttonNames(1)).toEqual(['Iniciar preparo', 'Cancelar pedido'])
    expect(buttonNames(2)).toEqual(['Saiu para entrega', 'Cancelar pedido'])
    expect(buttonNames(3)).toEqual(['Marcar como entregue'])
    expect(buttonNames(4)).toEqual([])
    expect(buttonNames(5)).toEqual([])
  })

  it('changes the status and refreshes the list', async () => {
    const api = mockOrders([orderSummary(1, 'RECEBIDO')])
    const { user } = renderApp('/orders')

    await user.click(
      within(await screen.findByRole('listitem', { name: 'Pedido #1' })).getByRole('button', {
        name: 'Iniciar preparo',
      }),
    )

    expect(await within(card(1)).findByText('Em preparo')).toHaveClass('status-badge')
    expect(api.patches).toEqual([{ id: 1, status: 'EM_PREPARO' }])
    expect(buttonNames(1)).toEqual(['Saiu para entrega', 'Cancelar pedido'])
  })

  it('asks for confirmation before cancelling', async () => {
    const api = mockOrders([orderSummary(1, 'RECEBIDO')])
    const { user } = renderApp('/orders')

    const cancel = within(await screen.findByRole('listitem', { name: 'Pedido #1' })).getByRole(
      'button',
      { name: 'Cancelar pedido' },
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

    expect(await within(card(1)).findByText('Cancelado')).toBeInTheDocument()
    expect(api.patches).toEqual([{ id: 1, status: 'CANCELADO' }])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows the 409 returned by the API', async () => {
    mockOrders([orderSummary(1, 'RECEBIDO')])
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

    expect(await within(card(1)).findByRole('alert')).toHaveTextContent(
      'Não é possível alterar o status de CANCELADO para EM_PREPARO.',
    )
  })

  it('filters by status through the API and shows the empty state', async () => {
    const api = mockOrders([])
    const { user } = renderApp('/orders')
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
    const { user } = renderApp('/orders')

    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    expect(await screen.findByRole('listitem', { name: 'Pedido #11' })).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    expect(requestedPages).toEqual(['0', '1'])
  })

  it('shows an error state with retry', async () => {
    let calls = 0
    server.use(
      http.get('/api/orders', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ status: 500, detail: 'Erro inesperado.' }, { status: 500 })
          : HttpResponse.json(page([orderSummary(1, 'RECEBIDO')]))
      }),
    )
    const { user } = renderApp('/orders')

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro inesperado.')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByRole('listitem', { name: 'Pedido #1' })).toBeInTheDocument()
  })
})
