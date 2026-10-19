import { newUser } from '../support/api'
import {
  CEPS,
  expect,
  fillAddress,
  loginViaUi,
  orderCard,
  test,
  ticketIn,
} from '../support/fixtures'

// Sign-up takes no address: the first one is registered with the first order and becomes the
// default, so the "sign-up with address" step is sign-up followed by that first order.
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

  await test.step('sai e entra de novo', async () => {
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await loginViaUi(page, user)
  })

  const orderId = await test.step('primeiro pedido cadastra o endereço', async () => {
    await page.getByRole('link', { name: 'Novo pedido' }).click()
    await page.getByRole('button', { name: 'Adicionar X-Burguer' }).click()
    await page.getByRole('button', { name: 'Adicionar Batata frita' }).click()
    await expect(
      page.getByRole('list', { name: 'Itens do pedido' }).getByRole('listitem'),
    ).toHaveCount(2)
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByLabel('Cliente')).toHaveValue(user.name)
    await fillAddress(
      page.getByRole('group', { name: 'Novo endereço' }),
      CEPS.paulista,
      '1000',
      'Casa',
    )
    // Not saved with its own button: the order warns, then saves it.
    await page.getByRole('button', { name: 'Criar pedido' }).click()
    const warning = page.getByRole('alertdialog', { name: 'Endereço não salvo' })
    await expect(warning).toBeVisible()

    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/orders',
    )
    await warning.getByRole('button', { name: 'Salvar e criar pedido' }).click()
    const response = await created
    expect(response.status()).toBe(201)
    return ((await response.json()) as { id: number }).id
  })

  await test.step('aparece no quadro, na coluna Recebido', async () => {
    await expect(page).toHaveURL(/\/orders$/)
    const ticket = ticketIn(page, 'Recebido', orderId)
    await expect(ticket).toContainText(user.name)
    await expect(ticket).toContainText('1x X-Burguer')
    await expect(ticket).toContainText('1x Batata frita')
  })

  await test.step('aparece na lista com o endereço e o carimbo Recebido', async () => {
    await page.getByRole('button', { name: 'Lista' }).click()
    const card = orderCard(page, orderId)
    await expect(card.locator('.stamp')).toHaveText('Recebido')
    await expect(card).toContainText('Avenida Paulista, 1000')
  })

  await test.step('o endereço do primeiro pedido vira o padrão', async () => {
    await page.getByRole('link', { name: 'Novo pedido' }).click()
    await page.getByRole('button', { name: 'Adicionar X-Burguer' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    const casa = page.getByRole('radio', { name: /Casa/ })
    await expect(casa).toBeChecked()
    await expect(page.locator('label.address-option', { has: casa }).locator('.badge')).toHaveText(
      'Padrão',
    )
  })
})
