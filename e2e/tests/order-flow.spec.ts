import { newUser } from '../support/api'
import {
  CEPS,
  expect,
  fillAddress,
  goToOrders,
  loginViaUi,
  orderCard,
  test,
} from '../support/fixtures'

// Sign-up takes no address (the first one is added later and becomes the default), so the
// "sign-up with address" step is sign-up followed by the first address on /addresses.
test('cadastro com endereço, login e pedido com dois itens aparece como Recebido', async ({
  page,
}) => {
  const user = newUser('flow')

  await test.step('cadastro', async () => {
    await page.goto('/register')
    await page.getByLabel('Nome').fill(user.name)
    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha', { exact: true }).fill(user.password)
    await page.getByLabel('Confirmar senha').fill(user.password)
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page).toHaveURL(/\/orders$/)
  })

  await test.step('primeiro endereço vira o padrão', async () => {
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Endereços' })
      .click()
    await page.getByRole('button', { name: 'Novo endereço' }).click()
    await fillAddress(
      page.getByRole('region', { name: 'Novo endereço' }),
      CEPS.paulista,
      '1000',
      'Casa',
    )
    await page.getByRole('button', { name: 'Adicionar endereço' }).click()
    await expect(page.getByRole('status')).toHaveText('Endereço adicionado.')
    await expect(page.getByRole('listitem', { name: 'Casa' })).toContainText('Padrão')
  })

  await test.step('sai e entra de novo', async () => {
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await loginViaUi(page, user)
  })

  const orderId = await test.step('novo pedido já vem com o endereço padrão', async () => {
    await goToOrders(page)
    await page.getByRole('link', { name: 'Novo pedido' }).click()
    await expect(page.getByRole('radio', { name: /Casa/ })).toBeChecked()
    await expect(page.getByLabel('Cliente')).toHaveValue(user.name)

    await page.getByRole('button', { name: 'Adicionar X-Burguer' }).click()
    await page.getByRole('button', { name: 'Adicionar Batata frita' }).click()
    await expect(
      page.getByRole('list', { name: 'Itens do pedido' }).getByRole('listitem'),
    ).toHaveCount(2)

    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/orders',
    )
    await page.getByRole('button', { name: 'Criar pedido' }).click()
    const response = await created
    expect(response.status()).toBe(201)
    return ((await response.json()) as { id: number }).id
  })

  await test.step('aparece na lista como Recebido', async () => {
    await expect(page).toHaveURL(/\/orders$/)
    const card = orderCard(page, orderId)
    await expect(card.locator('.status-badge')).toHaveText('Recebido')
    await expect(card).toContainText(user.name)
    await expect(card).toContainText('Avenida Paulista, 1000')
    await expect(card).toContainText('2 itens')
  })
})
