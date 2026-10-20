import axios, { type InternalAxiosRequestConfig } from 'axios'
import { clearSession, readSession, sessionFrom, writeSession } from '../session'
import type { LoginResponse } from '../../types/session'
import { apiUrl } from './endpoints'

export const api = axios.create({ baseURL: apiUrl() })

export const LOGIN_PATH = '/auth/login'
export const REFRESH_PATH = '/auth/refresh'
export const LOGOUT_PATH = '/auth/logout'

// They carry the refresh cookie (withCredentials) instead of the access token, and a 401 from them
// never triggers a refresh.
const COOKIE_PATHS = new Set([LOGIN_PATH, REFRESH_PATH, LOGOUT_PATH])

/** Refresh a little before the access token expires, so it never reaches the server stale. */
const EXPIRY_MARGIN_MS = 30_000

const REFRESH_LOCK = 'foody.refresh'

let onUnauthorized: (() => void) | null = null
let refreshing: Promise<string | null> | null = null

/** Registered by the AuthProvider: clears the session and sends the user to /login. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

/** A usable access token, refreshed first if the stored one is about to expire; null if logged out. */
export async function accessToken(): Promise<string | null> {
  const session = readSession()
  if (!session) return null
  if (session.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return session.token
  return refreshAccessToken(session.token)
}

/**
 * Trades the refresh cookie for a new access token, replacing `staleToken`. Resolves to null when
 * the session is over (the refresh token was rejected); network errors reject.
 *
 * The refresh token is single-use, and the server takes a second use for theft and ends the
 * session. So refreshes are serialized: within the tab by sharing one promise, across tabs (they
 * share the cookie) by a Web Lock, and whoever gets the lock after another tab already refreshed
 * just uses the new token.
 */
export function refreshAccessToken(staleToken: string): Promise<string | null> {
  refreshing ??= withRefreshLock(async () => {
    const current = readSession()
    if (!current) return null
    if (current.token !== staleToken && current.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
      return current.token
    }
    try {
      const { data } = await api.post<LoginResponse>(REFRESH_PATH, null, { withCredentials: true })
      const next = sessionFrom(data)
      writeSession(next)
      return next.token
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        clearSession()
        return null
      }
      throw error
    }
  }).finally(() => {
    refreshing = null
  })
  return refreshing
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  // Web Locks are missing in old browsers and in jsdom; the in-tab promise still dedupes there.
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(REFRESH_LOCK, task)
    : task()
}

api.interceptors.request.use(async (config) => {
  if (COOKIE_PATHS.has(config.url ?? '')) return config
  const token = await accessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      throw error
    }
    // From the login form a 401 is just bad credentials; refresh failures are handled above.
    const config: RetriableConfig = error.config
    if (COOKIE_PATHS.has(config.url ?? '')) throw error

    // Rejected before its time (the client clock is behind, or it was revoked): one refresh
    // decides, and the request is retried once with the new token.
    const sent = bearerToken(config.headers.Authorization)
    if (sent && !config._retried && (await refreshAccessToken(sent))) {
      config._retried = true
      return api(config)
    }
    // The session is gone: revoked, or there was no token left to send.
    onUnauthorized?.()
    throw error
  },
)

function bearerToken(header: unknown): string | null {
  return typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null
}
