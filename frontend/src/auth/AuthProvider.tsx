import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api, setUnauthorizedHandler } from '../api/client'
import { AuthContext, type AuthContextValue } from './context'
import { clearSession, readSession, writeSession } from './session'
import type { LoginResponse, RegisterInput, Session, User } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession)
  const navigate = useNavigate()

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

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
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
    const next: Session = {
      token: data.token,
      expiresAt: Date.now() + data.expiresIn * 1000,
      user: data.user,
    }
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
      token: session?.token ?? null,
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
