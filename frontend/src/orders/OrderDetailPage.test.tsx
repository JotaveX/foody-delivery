import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { storeSession, user as fixtureUser } from '../test/fixtures'
import { history, orderDetail } from '../test/orderFixtures'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

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

    expect(await screen.findByRole('heading', { name: /Pedido #7/ })).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows.map((r) => r.textContent?.replace(/\s/g, ' '))).toEqual([
      'ItemQtd.UnitárioSubtotal',
      'X-Burguer2R$ 24,90R$ 49,80',
      'Refrigerante Lata1R$ 6,90R$ 6,90',
      'TotalR$ 56,70',
    ])
    expect(rows[1].querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('catalog/x-burguer.webp'),
    )
    const address = screen.getByRole('region', { name: 'Endereço de entrega' })
    expect(address).toHaveTextContent('Avenida Paulista, 1000')
    expect(address).toHaveTextContent('CEP 01310-100')

    const timeline = within(screen.getByRole('region', { name: 'Histórico' }))
    const entries = await timeline.findAllByRole('listitem')
    expect(entries[0]).toHaveTextContent('Pedido criado')
    expect(entries[0]).toHaveTextContent('Maria Silva')
    expect(entries[1]).toHaveTextContent('Recebido → Em preparo')
    expect(entries[1]).toHaveTextContent('Operador')
    expect(screen.getByRole('button', { name: 'Saiu para entrega' })).toBeInTheDocument()
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
