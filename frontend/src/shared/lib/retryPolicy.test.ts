import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isTransientError, MAX_RETRIES, retryDelay, shouldRetry } from './retryPolicy'

function httpError(status?: number) {
  const config = { headers: new AxiosHeaders() }
  const response =
    status === undefined
      ? undefined
      : ({ status, data: {}, headers: {}, statusText: '', config } as AxiosResponse)
  return new AxiosError('failed', undefined, config, undefined, response)
}

describe('retry policy', () => {
  afterEach(() => vi.restoreAllMocks())

  it('treats network failures, timeouts and 5xx as transient', () => {
    expect(isTransientError(httpError())).toBe(true)
    expect(isTransientError(httpError(408))).toBe(true)
    expect(isTransientError(httpError(500))).toBe(true)
    expect(isTransientError(httpError(503))).toBe(true)
  })

  it('does not retry answers that will not change, nor a rate limit', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(isTransientError(httpError(status))).toBe(false)
    }
    expect(isTransientError(new Error('bug'))).toBe(false)
  })

  it(`retries a transient error ${MAX_RETRIES} times`, () => {
    const attempts = Array.from({ length: MAX_RETRIES + 1 }, (_, i) =>
      shouldRetry(i, httpError(503)),
    )
    expect(attempts).toEqual([...Array(MAX_RETRIES).fill(true), false])
    expect(shouldRetry(0, httpError(404))).toBe(false)
  })

  it('backs off exponentially, with jitter and a ceiling', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    expect([0, 1, 2, 3, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 8000])
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect([0, 1, 2].map(retryDelay)).toEqual([500, 1000, 2000])
  })
})
