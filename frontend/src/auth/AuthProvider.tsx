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

  // Revalidate a stored token once on load (it may have been revoked) and refresh the user.
  const hasSession = session !== null
  useEffect(() => {
    if (!hasSession) return
    let active = true
    api
      .get<User>('/auth/me')
      .then(({ data }) => {
        const current = readSession()
        if (active && current) {
          const refreshed = { ...current, user: data }
          writeSession(refreshed)
          setSession(refreshed)
        }
      })
      .catch(() => {
        // 401 is handled by the interceptor; anything else keeps the cached user.
      })
    return () => {
      active = false
    }
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
    }),
    [session, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
