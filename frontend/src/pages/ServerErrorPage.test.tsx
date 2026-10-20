import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { storeSession, user as fixtureUser } from '@/test/fixtures'
import { orderSummary, page } from '@/test/orderFixtures'
import { renderApp } from '@/test/renderApp'
import { server } from '@/test/server'
import { MAX_RETRIES } from '@/shared/lib/retryPolicy'

describe('ServerErrorPage', () => {
  beforeEach(() => {
    storeSession()
    server.use(http.get('/api/auth/me', () => HttpResponse.json(fixtureUser)))
  })

  it('lands on the error page after every retry failed, and tries the screen again', async () => {
    let requests = 0
    let failing = true
    server.use(
      http.get('/api/orders', ({ request }) => {
        requests++
        if (failing) return HttpResponse.json({ status: 503 }, { status: 503 })
        const status = new URL(request.url).searchParams.get('status')
        return HttpResponse.json(page(status === 'RECEBIDO' ? [orderSummary(1, 'RECEBIDO')] : []))
      }),
    )
    const { user } = renderApp('/orders?status=RECEBIDO', { retryPolicy: true })

    expect(
      await screen.findByRole('heading', { name: 'Servidor indisponível' }),
    ).toBeInTheDocument()
    expect(screen.getByText(`${MAX_RETRIES + 1} de ${MAX_RETRIES + 1}`)).toBeInTheDocument()
    expect(requests).toBeGreaterThanOrEqual(MAX_RETRIES + 1)

    failing = false
    const retry = screen.getByRole('link', { name: 'Tentar novamente' })
    expect(retry).toHaveAttribute('href', '/orders?status=RECEBIDO')
    await user.click(retry)

    expect(await screen.findByRole('listitem', { name: 'Pedido #1' })).toBeInTheDocument()
  })

  it('keeps answers that will not change on screen instead of redirecting', async () => {
    server.use(
      http.get('/api/orders/:id', () =>
        HttpResponse.json({ status: 404, detail: 'Pedido não encontrado.' }, { status: 404 }),
      ),
    )
    renderApp('/orders/42', { retryPolicy: true })

    expect(
      await screen.findByRole('heading', { name: 'Pedido não encontrado' }),
    ).toBeInTheDocument()
  })

  it('offers the way back to the board when opened directly', async () => {
    renderApp('/error')

    expect(
      await screen.findByRole('heading', { name: 'Servidor indisponível' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tentar novamente' })).toHaveAttribute('href', '/')
  })
})
