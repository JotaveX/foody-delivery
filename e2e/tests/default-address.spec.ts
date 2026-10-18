import { createOrder, newUser, registerUser, tokenFor } from '../support/api'
import { CEPS, expect, fillAddress, loginViaUi, test } from '../support/fixtures'

test('endereço novo marcado como padrão abre selecionado no próximo pedido', async ({
  page,
  request,
}) => {
  const user = newUser('default')
  await registerUser(request, user)
  // First order: its address ("Casa") becomes the default.
  const { paulista } = CEPS
  await createOrder(request, await tokenFor(request, user), user.name, {
    label: 'Casa',
    street: paulista.logradouro,
    number: '1000',
    neighborhood: paulista.bairro,
    city: paulista.localidade,
    state: paulista.uf,
    zipCode: paulista.cep,
  })

  await loginViaUi(page, user)

  await test.step('pedido para outro endereço, marcado como padrão', async () => {
    await page.getByRole('link', { name: 'Novo pedido' }).click()
    await expect(page.getByRole('radio', { name: /Casa/ })).toBeChecked()

    await page.getByRole('radio', { name: /Cadastrar novo endereço/ }).check()
    await fillAddress(
      page.getByRole('group', { name: 'Novo endereço' }),
      CEPS.assembleia,
      '10',
      'Trabalho',
    )
    await page.getByLabel('Usar como meu endereço padrão').check()
    await page.getByRole('button', { name: 'Adicionar X-Burguer' }).click()
    await page.getByRole('button', { name: 'Criar pedido' }).click()
    await expect(page).toHaveURL(/\/orders$/)
  })

  await test.step('o próximo pedido já abre com ele', async () => {
    await page.getByRole('link', { name: 'Novo pedido' }).click()
    const trabalho = page.getByRole('radio', { name: /Trabalho/ })
    await expect(trabalho).toBeChecked()
    await expect(page.getByRole('radio', { name: /Casa/ })).not.toBeChecked()
    await expect(
      page.locator('label.address-option', { has: trabalho }).locator('.badge'),
    ).toHaveText('Padrão')
  })
})
