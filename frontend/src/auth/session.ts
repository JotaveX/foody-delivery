import type { LoginResponse, Session } from './types'

const STORAGE_KEY = 'foody.session'

const listeners = new Set<() => void>()

/**
 * The stored session, while its refresh token can still be valid. An expired access token is kept:
 * the API client trades the refresh cookie for a new one.
 */
export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    // Sessions saved before refresh tokens existed have no refreshExpiresAt: they are dropped.
    if (!session.token || !(session.refreshExpiresAt > Date.now())) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

/** The session started (login) or renewed (refresh) by an auth response. */
export function sessionFrom(data: LoginResponse, now = Date.now()): Session {
  return {
    token: data.token,
    expiresAt: now + data.expiresIn * 1000,
    refreshExpiresAt: now + data.refreshExpiresIn * 1000,
    user: data.user,
  }
}

export function writeSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  notify()
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
  notify()
}

/** Called after every write in this tab (e.g. a refresh made by the API client). */
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}
