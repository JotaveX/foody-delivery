import axios from 'axios'

/** Retries after the first failure: a query gets up to MAX_RETRIES + 1 attempts in total. */
export const MAX_RETRIES = 3

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 8_000

/**
 * Whether trying again may succeed: the server was unreachable, timed out or failed on its side.
 * 4xx answers (404, 401, 422…) will not change on retry, and 429 means retrying makes it worse.
 */
export function isTransientError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const status = error.response?.status
  return status === undefined || status === 408 || status >= 500
}

/** React Query `retry`: transient errors only, up to MAX_RETRIES times. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && isTransientError(error)
}

/**
 * React Query `retryDelay`: exponential backoff (1s, 2s, 4s… capped at 8s) with full jitter, so
 * clients that lost the server together do not all come back at the same instant.
 */
export function retryDelay(failureCount: number): number {
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** failureCount, MAX_DELAY_MS)
  return ceiling / 2 + Math.random() * (ceiling / 2)
}
