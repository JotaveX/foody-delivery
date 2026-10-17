import { api } from '../api/client'
import type { Address, AddressInput } from '../auth/types'

export async function listAddresses() {
  return (await api.get<Address[]>('/addresses')).data
}

export async function createAddress(address: AddressInput, makeDefault: boolean) {
  return (await api.post<Address>('/addresses', { address, makeDefault })).data
}

/** Addresses are immutable: the API returns a new version with a new id. */
export async function updateAddress(id: number, address: AddressInput) {
  return (await api.put<Address>(`/addresses/${id}`, address)).data
}

export async function makeDefaultAddress(id: number) {
  return (await api.patch<Address>(`/addresses/${id}/default`)).data
}

export async function deleteAddress(id: number) {
  await api.delete(`/addresses/${id}`)
}
