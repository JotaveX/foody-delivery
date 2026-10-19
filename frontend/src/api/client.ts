import axios from 'axios'
import { readSession } from '../auth/session'
import { apiUrl } from './endpoints'

export const api = axios.create({ baseURL: apiUrl() })

export const LOGIN_PATH = '/auth/login'

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
    // A 401 from the login form is just bad credentials. Any other 401 means the session is gone:
    // the token was rejected, or it expired and readSession dropped it before the request.
    const isLogin = error?.config?.url === LOGIN_PATH
    if (axios.isAxiosError(error) && error.response?.status === 401 && !isLogin) {
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)
