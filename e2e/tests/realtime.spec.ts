import type { Page } from '@playwright/test'
import { createOrder, newUser, registerUser, tokenFor } from '../support/api'
import { CEPS, expect, loginViaUi, orderCard, test, ticketIn } from '../support/fixtures'

/**
 * Resolves once the page has subscribed to the order topic over STOMP. Must be called before the
 * page opens the socket (i.e. before logging in). Vite's HMR socket is ignored.
 */
function ordersSubscription(page: Page): Promise<void> {
  return new Promise((resolve) => {
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname !== '/ws') return
      ws.on('framesent', ({ payload }) => {
        const frame = payload.toString()
        if (frame.startsWith('SUBSCRIBE') && frame.includes('destination:/topic/orders')) resolve()
      })
    })
  })
}

test('mudança de status aparece em outro navegador sem recarregar a página', async ({
  browser,
  request,
}) => {
  const actor = newUser('actor')
  const observer = newUser('observer')
  await registerUser(request, actor)
  await registerUser(request, observer)
  const { paulista } = CEPS
  const orderId = await createOrder(request, await tokenFor(request, actor), actor.name, {
    street: paulista.logradouro,
    number: '500',
    neighborhood: paulista.bairro,
    city: paulista.localidade,
    state: paulista.uf,
    zipCode: paulista.cep,
  })

  const actorContext = await browser.newContext()
  const observerContext = await browser.newContext()
  try {
    const actorPage = await actorContext.newPage()
    const observerPage = await observerContext.newPage()

    const observerLive = ordersSubscription(observerPage)
    await loginViaUi(actorPage, actor)
    await loginViaUi(observerPage, observer)
    await observerLive

    await expect(ticketIn(actorPage, 'Recebido', orderId)).toBeVisible()
    await expect(ticketIn(observerPage, 'Recebido', orderId)).toBeVisible()

    // Proof that the observer neither reloads nor refetches: the update must come over STOMP.
    await observerPage.evaluate(() => {
      ;(window as { e2eNotReloaded?: boolean }).e2eNotReloaded = true
    })
    const refetches: string[] = []
    observerPage.on('request', (r) => {
      if (r.method() === 'GET' && new URL(r.url()).pathname.startsWith('/api/orders')) {
        refetches.push(r.url())
      }
    })

    await orderCard(actorPage, orderId).getByRole('button', { name: 'Iniciar preparo' }).click()
    await expect(ticketIn(actorPage, 'Em preparo', orderId)).toBeVisible()

    // The ticket moves to the next column on the observer's board.
    const observerTicket = ticketIn(observerPage, 'Em preparo', orderId)
    await expect(observerTicket).toBeVisible({ timeout: 5_000 })
    await expect(ticketIn(observerPage, 'Recebido', orderId)).toHaveCount(0)
    await expect(observerTicket.getByRole('button', { name: 'Saiu p/ entrega' })).toBeVisible()
    expect(
      await observerPage.evaluate(() => (window as { e2eNotReloaded?: boolean }).e2eNotReloaded),
    ).toBe(true)
    expect(refetches).toEqual([])
  } finally {
    await actorContext.close()
    await observerContext.close()
  }
})
