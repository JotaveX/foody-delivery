import { apiLogin, newUser, registerUser } from '../support/api'
import { expect, loginViaUi, test } from '../support/fixtures'
import { waitForEmail } from '../support/mailpit'

test('recuperação de senha pelo link do e-mail', async ({ page, request }) => {
  const user = newUser('reset')
  await registerUser(request, user)
  const newPassword = 'senha-nova-456'

  await test.step('pede o link', async () => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Esqueceu a senha?' }).click()
    await expect(page.getByRole('heading', { name: 'Esqueci a senha' })).toBeVisible()
    await page.getByLabel('E-mail').fill(user.email)
    await page.getByRole('button', { name: 'Enviar link' }).click()
    await expect(page.getByRole('status')).toContainText('Se houver uma conta com esse e-mail')
  })

  const link = await test.step('busca o e-mail no Mailpit', async () => {
    const text = await waitForEmail(request, user.email)
    const match = text.match(/https?:\/\/\S+\/reset-password\?token=[\w-]+/)
    expect(match, text).not.toBeNull()
    return new URL(match![0])
  })

  await test.step('abre o link e troca a senha', async () => {
    await page.goto(link.pathname + link.search)
    // The page drops the token from the address bar once it has read it.
    await expect(page).toHaveURL(/\/reset-password$/)
    await page.getByLabel('Nova senha', { exact: true }).fill(newPassword)
    await page.getByLabel('Confirmar nova senha').fill(newPassword)
    await page.getByRole('button', { name: 'Salvar nova senha' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('status')).toHaveText('Senha redefinida. Entre com a nova senha.')
  })

  await test.step('entra com a nova senha; a antiga deixa de valer', async () => {
    await loginViaUi(page, { email: user.email, password: newPassword })
    await expect(page.getByRole('banner')).toContainText(user.name)
    expect((await apiLogin(request, user.email, user.password)).status()).toBe(401)
  })
})
