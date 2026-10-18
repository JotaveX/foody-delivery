import { request, type FullConfig } from '@playwright/test'

/**
 * The suite signs up and logs in many times from one IP, well past the per-IP limits (3 sign-ups
 * and 5 logins per minute), so it needs a backend started with RATE_LIMIT_ENABLED=false. With the
 * limits on, every response carries X-RateLimit-Remaining: fail once, up front, instead of with
 * scattered 429s.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL
  const api = await request.newContext({ baseURL })
  try {
    const response = await api.post('/api/auth/login', {
      data: { email: 'rate-limit-probe@foody.test', password: 'probe' },
    })
    if (response.status() === 429 || response.headers()['x-ratelimit-remaining'] !== undefined) {
      throw new Error(
        'O backend está com rate limit ligado. Suba-o com RATE_LIMIT_ENABLED=false ' +
          '(ex.: RATE_LIMIT_ENABLED=false ./mvnw spring-boot:run) e rode a suíte de novo.',
      )
    }
  } finally {
    await api.dispose()
  }
}
