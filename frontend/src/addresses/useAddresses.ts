import { useQuery } from '@tanstack/react-query'
import { listAddresses } from './api'

export const addressKeys = { all: ['addresses'] as const }

export function useAddresses() {
  return useQuery({ queryKey: addressKeys.all, queryFn: listAddresses })
}
