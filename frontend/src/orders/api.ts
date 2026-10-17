import { api } from '../api/client'
import type { AddressInput } from '../auth/types'
import type {
  HistoryEntry,
  NewOrderItem,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Page,
} from './types'

export interface OrderFilters {
  status?: OrderStatus
  page: number
  size: number
}

export type CreateOrderInput = {
  customerName: string
  items: NewOrderItem[]
} & ({ addressId: number } | { newAddress: AddressInput; saveAsDefault: boolean })

export async function listOrders({ status, page, size }: OrderFilters) {
  const params = { page, size, ...(status ? { status } : {}) }
  return (await api.get<Page<OrderSummary>>('/orders', { params })).data
}

export async function getOrder(id: number) {
  return (await api.get<OrderDetail>(`/orders/${id}`)).data
}

export async function getOrderHistory(id: number) {
  return (await api.get<HistoryEntry[]>(`/orders/${id}/history`)).data
}

export async function createOrder(input: CreateOrderInput) {
  return (await api.post<OrderDetail>('/orders', input)).data
}

export async function changeOrderStatus(id: number, status: OrderStatus) {
  return (await api.patch<OrderDetail>(`/orders/${id}/status`, { status })).data
}
