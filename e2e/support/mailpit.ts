import { expect, type APIRequestContext } from '@playwright/test'

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025'

interface SearchResult {
  messages: { ID: string; Subject: string }[]
}

/**
 * Waits for the newest e-mail sent to `to` and returns its plain-text body. The backend sends
 * e-mails asynchronously, so the message may only show up a moment after the request returns.
 */
export async function waitForEmail(request: APIRequestContext, to: string): Promise<string> {
  let id: string | undefined
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILPIT_URL}/api/v1/search`, {
          params: { query: `to:"${to}"`, limit: 1 },
        })
        id = ((await response.json()) as SearchResult).messages[0]?.ID
        return id
      },
      { message: `e-mail para ${to} no Mailpit`, timeout: 15_000 },
    )
    .toBeDefined()

  const message = await request.get(`${MAILPIT_URL}/api/v1/message/${id}`)
  expect(message.ok()).toBe(true)
  return ((await message.json()) as { Text: string }).Text
}
