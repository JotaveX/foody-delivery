import type { HistoryEntry, OrderDetail, OrderStatus, OrderSummary, Page } from '../orders/types'

export const deliveryAddress = {
  id: 1,
  label: 'Casa',
  street: 'Avenida Paulista',
  number: '1000',
  complement: null,
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01310100',
}

export function orderSummary(id: number, status: OrderStatus): OrderSummary {
  return {
    id,
    customerName: `Cliente ${id}`,
    status,
    totalAmount: 33.9,
    itemCount: 2,
    deliveryAddress,
    createdAt: '2026-10-17T15:30:00Z',
    updatedAt: '2026-10-17T15:30:00Z',
  }
}

export function orderDetail(id: number, status: OrderStatus): OrderDetail {
  const { id: _id, itemCount, ...summary } = orderSummary(id, status)
  void itemCount
  return {
    id,
    ...summary,
    items: [
      { id: 1, name: 'X-Burger', quantity: 2, unitPrice: 12.5, subtotal: 25, imageUrl: null },
      { id: 2, name: 'Refrigerante', quantity: 1, unitPrice: 8.9, subtotal: 8.9, imageUrl: null },
    ],
    createdBy: { id: 1, name: 'Maria Silva' },
  }
}

export const history: HistoryEntry[] = [
  {
    fromStatus: null,
    toStatus: 'RECEBIDO',
    changedAt: '2026-10-17T15:30:00Z',
    changedBy: { id: 1, name: 'Maria Silva' },
  },
  {
    fromStatus: 'RECEBIDO',
    toStatus: 'EM_PREPARO',
    changedAt: '2026-10-17T15:40:00Z',
    changedBy: { id: 2, name: 'Operador' },
  },
]

export function page<T>(content: T[], pageNumber = 0, totalPages = 1): Page<T> {
  return { content, page: pageNumber, size: 10, totalElements: content.length, totalPages }
}
