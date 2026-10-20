import type { Page } from '@playwright/test'
import { newUser, registerUser } from '../support/api'
import { expect, loginViaUi, test } from '../support/fixtures'

const SESSION_KEY = 'foody.session'

function storedSession(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as { expiresAt: number } | null,
    SESSION_KEY,
  )
}

/** Makes the stored access token look expired, as if the tab had been left open for hours. */
function expireAccessToken(page: Page) {
  return page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key)!)
    localStorage.setItem(key, JSON.stringify({ ...session, expiresAt: Date.now() - 1000 }))
  }, SESSION_KEY)
}

test('o refresh token renova a sessão e o logout o revoga', async ({ page, request }) => {
  const user = newUser('session')
  await registerUser(request, user)

  await test.step('entra; o refresh token fica num cookie HttpOnly em /api/auth', async () => {
    await page.goto('/login')
    await loginViaUi(page, user)
    const cookie = (await page.context().cookies()).find((c) => c.name === 'foody_refresh')
    expect(cookie).toMatchObject({ path: '/api/auth', httpOnly: true, sameSite: 'Strict' })
  })

  await test.step('com o access token vencido, a página renova em vez de deslogar', async () => {
    await expireAccessToken(page)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible()
    // Not the token itself: a refresh in the same second as the login signs identical claims.
    await expect
      .poll(async () => (await storedSession(page))?.expiresAt ?? 0)
      .toBeGreaterThan(Date.now())
  })

  await test.step('depois de sair, o cookie não renova mais a sessão', async () => {
    const cookieBeforeLogout = (await page.context().cookies()).find(
      (c) => c.name === 'foody_refresh',
    )!
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect
      .poll(async () => (await page.context().cookies()).some((c) => c.name === 'foody_refresh'))
      .toBe(false)

    // Even a copy of the cookie taken before the logout is now useless.
    await page.context().addCookies([cookieBeforeLogout])
    const status = await page.evaluate(() =>
      fetch('/api/auth/refresh', { method: 'POST' }).then((r) => r.status),
    )
    expect(status).toBe(401)
  })
})
