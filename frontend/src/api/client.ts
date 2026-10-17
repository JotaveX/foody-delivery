import axios from 'axios'
import { readSession } from '../auth/session'

export const api = axios.create({ baseURL: '/api' })

let onUnauthorized: (() => void) | null = null

/** Registered by the AuthProvider: clears the session and sends the user to /login. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

api.interceptors.request.use((config) => {
  const token = readSession()?.token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only a rejected token ends the session; a 401 from the login form is just bad credentials.
    const sentToken = Boolean(error?.config?.headers?.Authorization)
    if (axios.isAxiosError(error) && error.response?.status === 401 && sentToken) {
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)
