import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { storeSession, user as fixtureUser } from '@/test/fixtures'
import { history, orderDetail } from '@/test/orderFixtures'
import { renderApp } from '@/test/renderApp'
import { server } from '@/test/server'

describe('OrderDetailPage', () => {
  beforeEach(() => {
    storeSession()
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
  })

  it('shows items, total, delivery address and the status timeline', async () => {
    server.use(
      http.get('/api/orders/7', () => HttpResponse.json(orderDetail(7, 'EM_PREPARO'))),
      http.get('/api/orders/7/history', () => HttpResponse.json(history)),
    )
    renderApp('/orders/7')

    const ticket = await screen.findByRole('article', { name: 'Pedido #7' })
    expect(within(ticket).getByText('Em preparo')).toHaveClass('stamp', 'stamp-em-preparo')
    const rows = within(within(ticket).getByRole('table')).getAllByRole('row')
    expect(rows.map((r) => r.textContent?.replace(/\s/g, ' '))).toEqual([
      'QTDITEMVALOR',
      '2X-Burguerun. R$ 24,9049,80',
      '1Refrigerante Lataun. R$ 6,906,90',
    ])
    expect(within(ticket).getByText('TOTAL').parentElement).toHaveTextContent(/R\$\s56,70/)
    const address = within(ticket).getByRole('region', { name: 'Entregar em' })
    expect(address).toHaveTextContent('Avenida Paulista, 1000')
    expect(address).toHaveTextContent('CEP 01310-100')

    // What happened, the time between steps, then the steps still ahead.
    const timeline = within(screen.getByRole('region', { name: 'Linha do tempo' }))
    const entries = await timeline.findAllByRole('listitem')
    expect(entries).toHaveLength(4)
    expect(entries[0]).toHaveTextContent('Pedido criado · Maria Silva')
    expect(entries[0]).toHaveTextContent('+10 min')
    expect(entries[1]).toHaveTextContent('Recebido → Em preparo · Operador')
    expect(entries[1]).toHaveClass('timeline-step-current')
    expect(entries[2]).toHaveTextContent('Saiu para entregapróxima etapa')
    expect(entries[2]).toHaveClass('timeline-step-future')
    expect(entries[3]).toHaveTextContent('Entregue')
    expect(screen.getByRole('button', { name: 'Saiu para entrega' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument()
  })

  it('shows a cancelled order as closed, without actions or future steps', async () => {
    server.use(
      http.get('/api/orders/7', () =>
        HttpResponse.json({ ...orderDetail(7, 'CANCELADO'), updatedAt: '2026-10-17T15:42:00Z' }),
      ),
      http.get('/api/orders/7/history', () =>
        HttpResponse.json([
          history[0],
          { ...history[1], toStatus: 'CANCELADO', changedAt: '2026-10-17T15:42:00Z' },
        ]),
      ),
    )
    renderApp('/orders/7')

    const timeline = within(await screen.findByRole('region', { name: 'Linha do tempo' }))
    const entries = await timeline.findAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(entries[1]).toHaveClass('timeline-step-cancelled')
    expect(screen.getByText(/Pedido encerrado: cancelado/)).toBeInTheDocument()
    expect(screen.getByText(/Do pedido ao cancelamento/)).toHaveTextContent('12 min')
    expect(screen.queryByRole('button', { name: /Cancelar/ })).not.toBeInTheDocument()
  })

  it('shows not found for an unknown order', async () => {
    server.use(
      http.get('/api/orders/404', () =>
        HttpResponse.json({ status: 404, detail: 'Pedido não encontrado.' }, { status: 404 }),
      ),
      http.get('/api/orders/404/history', () =>
        HttpResponse.json({ status: 404, detail: 'Pedido não encontrado.' }, { status: 404 }),
      ),
    )
    renderApp('/orders/404')

    expect(
      await screen.findByRole('heading', { name: 'Pedido não encontrado' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para os pedidos' })).toBeInTheDocument()
  })
})
