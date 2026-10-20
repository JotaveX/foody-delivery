import type { User } from './user'

/** Login and refresh answer alike; the refresh token itself comes in an HttpOnly cookie. */
export interface LoginResponse {
  token: string
  /** Seconds until the token expires. */
  expiresIn: number
  /** Seconds until the refresh token expires (renewed on every refresh). */
  refreshExpiresIn: number
  user: User
}

export interface Session {
  token: string
  /** Epoch millis; past it, the API client refreshes the token. */
  expiresAt: number
  /** Epoch millis; past it, the session is over. */
  refreshExpiresAt: number
  user: User
}
