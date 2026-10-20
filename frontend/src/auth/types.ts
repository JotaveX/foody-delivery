export interface Address {
  id: number
  label: string | null
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isDefault: boolean
}

export interface User {
  id: number
  name: string
  email: string
  createdAt: string
  defaultAddress: Address | null
}

/** Login and refresh answer alike; the refresh token itself comes in an HttpOnly cookie. */
export interface LoginResponse {
  token: string
  /** Seconds until the token expires. */
  expiresIn: number
  /** Seconds until the refresh token expires (renewed on every refresh). */
  refreshExpiresIn: number
  user: User
}

export interface AddressInput {
  label?: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

export interface RegisterInput {
  name: string
  email: string
  password: string
}

export interface Session {
  token: string
  /** Epoch millis; past it, the API client refreshes the token. */
  expiresAt: number
  /** Epoch millis; past it, the session is over. */
  refreshExpiresAt: number
  user: User
}
