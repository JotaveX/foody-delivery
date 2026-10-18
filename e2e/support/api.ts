import { expect, type APIRequestContext } from '@playwright/test'

// Direct API calls (through the Vite proxy, like the SPA) to set up state a test is not about.

export interface TestUser {
  name: string
  email: string
  password: string
}

export interface AddressInput {
  label?: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

/** A user no other test (or earlier run) has used. */
export function newUser(tag: string): TestUser {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  return {
    name: `E2E ${tag} ${id}`,
    email: `e2e-${tag}-${id}@foody.test`,
    password: 'senha-original-123',
  }
}

export async function registerUser(request: APIRequestContext, user: TestUser) {
  const response = await request.post('/api/auth/register', { data: user })
  expect(response.status(), await response.text()).toBe(201)
}

export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  return request.post('/api/auth/login', { data: { email, password } })
}

export async function tokenFor(request: APIRequestContext, user: TestUser): Promise<string> {
  const response = await apiLogin(request, user.email, user.password)
  expect(response.ok(), await response.text()).toBe(true)
  return ((await response.json()) as { token: string }).token
}

/** Creates an order for `user` delivered to a new address (their default if it is the first). */
export async function createOrder(
  request: APIRequestContext,
  token: string,
  customerName: string,
  newAddress: AddressInput,
): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` }
  const products = await request.get('/api/products', { headers })
  expect(products.ok()).toBe(true)
  const [first] = (await products.json()) as { id: number }[]

  const response = await request.post('/api/orders', {
    headers,
    data: { customerName, items: [{ productId: first.id, quantity: 1 }], newAddress },
  })
  expect(response.status(), await response.text()).toBe(201)
  return ((await response.json()) as { id: number }).id
}
