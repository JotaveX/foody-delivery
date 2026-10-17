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

export interface LoginResponse {
  token: string
  /** Seconds until the token expires. */
  expiresIn: number
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
  /** Epoch millis. */
  expiresAt: number
  user: User
}
