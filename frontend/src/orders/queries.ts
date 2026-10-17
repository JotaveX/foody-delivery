import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changeOrderStatus, getOrder, getOrderHistory, listOrders, type OrderFilters } from './api'
import type { OrderStatus } from './types'

/** Every order query starts with "orders", so one invalidation refreshes lists, details and history. */
export const orderKeys = {
  all: ['orders'] as const,
  list: (filters: OrderFilters) => ['orders', 'list', filters] as const,
  detail: (id: number) => ['orders', 'detail', id] as const,
  history: (id: number) => ['orders', 'history', id] as const,
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => listOrders(filters),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

export function useOrder(id: number) {
  return useQuery({ queryKey: orderKeys.detail(id), queryFn: () => getOrder(id) })
}

export function useOrderHistory(id: number) {
  return useQuery({ queryKey: orderKeys.history(id), queryFn: () => getOrderHistory(id) })
}

export function useChangeOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      changeOrderStatus(id, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  })
}
