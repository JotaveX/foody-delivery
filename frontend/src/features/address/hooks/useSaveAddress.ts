import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address } from '@/shared/types/user'
import { createAddress } from '../api/addresses'
import { toAddressInput, type AddressFormValues } from '../model/addressSchema'
import { addressKeys } from './useAddresses'

export function useSaveAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ values, makeDefault }: { values: AddressFormValues; makeDefault: boolean }) =>
      createAddress(toAddressInput(values), makeDefault),
    onSuccess: (created) => {
      // Shown (and selected) right away; the refetch then brings the server's order.
      queryClient.setQueryData<Address[]>(addressKeys.all, (current = []) => [
        ...current.map((a) => (created.isDefault ? { ...a, isDefault: false } : a)),
        created,
      ])
      void queryClient.invalidateQueries({ queryKey: addressKeys.all })
    },
  })
}
