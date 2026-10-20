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
