import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api, LOGIN_PATH, LOGOUT_PATH, setUnauthorizedHandler } from '../api/client'
import { AuthContext, type AuthContextValue } from './context'
import { clearSession, readSession, sessionFrom, subscribeSession, writeSession } from './session'
import type { LoginResponse, RegisterInput, Session, User } from './types'

const MAX_TIMEOUT_MS = 2 ** 31 - 1

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession)
  const navigate = useNavigate()

  const logout = useCallback(() => {
    // Revokes the refresh token and clears its cookie; the session ends here either way.
    void api.post(LOGOUT_PATH, null, { withCredentials: true }).catch(() => {})
    clearSession()
    setSession(null)
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // The API client refreshes the access token on its own and saves the new session.
  useEffect(() => subscribeSession(() => setSession(readSession())), [])

  // End the session when the refresh token expires instead of letting every request fail.
  // setTimeout caps delays at ~24.8 days, far above the refresh token lifetime.
  const refreshExpiresAt = session?.refreshExpiresAt
  useEffect(() => {
    if (refreshExpiresAt === undefined) return
    const timer = setTimeout(logout, Math.min(refreshExpiresAt - Date.now(), MAX_TIMEOUT_MS))
    return () => clearTimeout(timer)
  }, [refreshExpiresAt, logout])

  /** Reloads the current user (e.g. after the default address changed). */
  const refreshUser = useCallback(async () => {
    const { data } = await api.get<User>('/auth/me')
    setSession(storeUser(data))
  }, [])

  // Revalidate a stored token once on load (it may have been revoked) and refresh the user.
  const hasSession = session !== null
  useEffect(() => {
    if (!hasSession) return
    api.get<User>('/auth/me').then(
      ({ data }) => setSession(storeUser(data)),
      () => {
        // 401 is handled by the interceptor; anything else keeps the cached user.
      },
    )
  }, [hasSession])

  const login = useCallback(async (email: string, password: string) => {
    // withCredentials so the browser keeps the refresh cookie of a cross-origin API.
    const { data } = await api.post<LoginResponse>(
      LOGIN_PATH,
      { email, password },
      { withCredentials: true },
    )
    const next = sessionFrom(data)
    writeSession(next)
    setSession(next)
  }, [])

  const register = useCallback(
    async (input: RegisterInput) => {
      await api.post<User>('/auth/register', input)
      await login(input.email, input.password)
    },
    [login],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      login,
      register,
      logout,
      refreshUser,
    }),
    [session, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Saves a fresher copy of the user into the stored session and returns it. */
function storeUser(user: User): Session | null {
  const current = readSession()
  if (!current) return null
  const refreshed = { ...current, user }
  writeSession(refreshed)
  return refreshed
}
