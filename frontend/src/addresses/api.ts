import { api } from '../api/client'
import type { Address, AddressInput } from '../auth/types'

export async function listAddresses() {
  return (await api.get<Address[]>('/addresses')).data
}

export async function createAddress(address: AddressInput, makeDefault: boolean) {
  return (await api.post<Address>('/addresses', { address, makeDefault })).data
}
