export type OrderStatus = 'RECEBIDO' | 'EM_PREPARO' | 'SAIU_PARA_ENTREGA' | 'ENTREGUE' | 'CANCELADO'

export interface DeliveryAddress {
  id: number
  label: string | null
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

export interface UserRef {
  id: number
  name: string
}

export interface OrderSummary {
  id: number
  customerName: string
  status: OrderStatus
  totalAmount: number
  itemCount: number
  deliveryAddress: DeliveryAddress
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: number
  name: string
  quantity: number
  unitPrice: number
  subtotal: number
  imageUrl: string | null
}

export interface OrderDetail extends Omit<OrderSummary, 'itemCount'> {
  items: OrderItem[]
  createdBy: UserRef
}

export interface HistoryEntry {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  changedAt: string
  changedBy: UserRef
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface NewOrderItem {
  name: string
  quantity: number
  unitPrice: number
}
