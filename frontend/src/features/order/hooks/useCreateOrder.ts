import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { addressKeys } from '@/features/address'
import { productKeys } from '@/features/catalog'
import { toApiError } from '@/shared/lib/api/problem'
import { createOrder, type CreateOrderInput } from '../api/orders'
import { orderKeys } from './queries'

/** `onAddressCreated` runs when the order also saved a new address, before the mutation settles. */
export function useCreateOrder({ onAddressCreated }: { onAddressCreated: () => Promise<unknown> }) {
  const queryClient = useQueryClient()
  // One key per opening of the form: every retry of the submit sends the same one.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input, idempotencyKey),
    onSuccess: async (_order, input) => {
      const createdAddress = 'newAddress' in input
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        createdAddress && queryClient.invalidateQueries({ queryKey: addressKeys.all }),
        // The default may have changed (asked for, or this was the user's first address).
        createdAddress && onAddressCreated(),
      ])
    },
    onError: (error) => {
      // A product may have left the catalog meanwhile (422): show the current one.
      if ('items' in toApiError(error).fieldErrors) {
        void queryClient.invalidateQueries({ queryKey: productKeys.all })
      }
    },
  })
}
