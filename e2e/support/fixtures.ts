import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'
import type { TestUser } from './api'

/** CEPs the ViaCEP stub knows; any other one answers "not found". */
export const CEPS = {
  paulista: {
    cep: '01310-100',
    logradouro: 'Avenida Paulista',
    bairro: 'Bela Vista',
    localidade: 'São Paulo',
    uf: 'SP',
  },
  assembleia: {
    cep: '20010-010',
    logradouro: 'Rua da Assembleia',
    bairro: 'Centro',
    localidade: 'Rio de Janeiro',
    uf: 'RJ',
  },
}

/**
 * The address form autofills from ViaCEP, straight from the browser. A stub keeps the suite off
 * the internet and deterministic.
 */
export async function stubViaCep(context: BrowserContext) {
  await context.route('https://viacep.com.br/ws/**', (route) => {
    const digits = new URL(route.request().url()).pathname.split('/')[2]
    const found = Object.values(CEPS).find((c) => c.cep.replace('-', '') === digits)
    return route.fulfill({
      json: found ?? { erro: 'true' },
      headers: { 'access-control-allow-origin': '*' },
    })
  })
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await stubViaCep(context)
    await use(context)
  },
})

export { expect }

/** Logs in from /login, or from wherever the app sent the user (e.g. after logging out). */
export async function loginViaUi(page: Page, user: Pick<TestUser, 'email' | 'password'>) {
  if (!new URL(page.url(), 'http://x').pathname.endsWith('/login')) await page.goto('/login')
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  // Login returns to the page the user came from (/orders by default).
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

/**
 * Types a CEP known to the ViaCEP stub into the address form inside `form` and waits for the
 * autofill. Scoped because saved addresses elsewhere on the page also mention "CEP".
 */
export async function fillAddress(
  form: Locator,
  address: (typeof CEPS)[keyof typeof CEPS],
  number: string,
  label: string,
) {
  await form.getByLabel('CEP').fill(address.cep)
  await expect(form.getByLabel('Rua')).toHaveValue(address.logradouro)
  await form.getByLabel('Número').fill(number)
  await form.getByLabel('Apelido do endereço (opcional)').fill(label)
}

/** The ticket (board) or row (list) of one order on /orders. */
export function orderCard(page: Page, id: number) {
  return page.getByRole('listitem', { name: `Pedido #${id}`, exact: true })
}

/** One order's ticket inside a board column ("Recebido", "Em preparo", "Saiu para entrega"). */
export function ticketIn(page: Page, column: string, id: number) {
  return page.getByRole('region', { name: column, exact: true }).getByRole('listitem', {
    name: `Pedido #${id}`,
    exact: true,
  })
}
