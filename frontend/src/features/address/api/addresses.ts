import { api } from '@/shared/lib/api/client'
import type { Address } from '@/shared/types/user'
import type { AddressInput } from '../types'

export async function listAddresses() {
  return (await api.get<Address[]>('/addresses')).data
}

export async function createAddress(address: AddressInput, makeDefault: boolean) {
  return (await api.post<Address>('/addresses', { address, makeDefault })).data
}
