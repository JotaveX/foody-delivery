import { api } from '../api/client'
import type { Address } from '../auth/types'

export async function listAddresses() {
  return (await api.get<Address[]>('/addresses')).data
}
