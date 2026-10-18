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
  items: OrderItemPreview[]
  deliveryAddress: DeliveryAddress
  createdAt: string
  updatedAt: string
}

/** What the order list shows of each item: one ticket line. */
export interface OrderItemPreview {
  productId: number
  name: string
  imageUrl: string
  quantity: number
  subtotal: number
}

/** unitPrice is the product price when the order was created. */
export interface OrderItem extends OrderItemPreview {
  unitPrice: number
}

export interface OrderDetail extends Omit<OrderSummary, 'itemCount' | 'items'> {
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

/** Only the product and the quantity: the price always comes from the catalog, on the server. */
export interface NewOrderItem {
  productId: number
  quantity: number
}
