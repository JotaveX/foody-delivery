import type { Product } from '../catalog/types'
import type {
  HistoryEntry,
  OrderDetail,
  OrderItem,
  OrderStatus,
  OrderSummary,
  Page,
} from '../orders/types'

const IMAGES = 'https://storage.googleapis.com/foody-test/catalog'

export const products: Product[] = [
  {
    id: 1,
    slug: 'x-burguer',
    name: 'X-Burguer',
    description: 'Hambúrguer bovino de 150 g, queijo, alface, tomate e maionese da casa.',
    category: 'LANCHES',
    price: 24.9,
    imageUrl: `${IMAGES}/x-burguer.webp`,
  },
  {
    id: 2,
    slug: 'batata-frita',
    name: 'Batata frita',
    description: 'Porção de 400 g de batata frita crocante.',
    category: 'LANCHES',
    price: 19.9,
    imageUrl: `${IMAGES}/batata-frita.webp`,
  },
  {
    id: 5,
    slug: 'pizza-calabresa',
    name: 'Pizza de Calabresa',
    description: 'Grande, 8 fatias: calabresa, cebola, mussarela e azeitonas.',
    category: 'PIZZA',
    price: 54.9,
    imageUrl: `${IMAGES}/pizza-calabresa.webp`,
  },
  {
    id: 20,
    slug: 'refrigerante-lata',
    name: 'Refrigerante Lata',
    description: 'Lata de 350 ml, gelada.',
    category: 'SOBREMESAS_BEBIDAS',
    price: 6.9,
    imageUrl: `${IMAGES}/refrigerante-lata.webp`,
  },
]

const orderItems: OrderItem[] = [
  {
    productId: 1,
    name: 'X-Burguer',
    imageUrl: `${IMAGES}/x-burguer.webp`,
    quantity: 2,
    unitPrice: 24.9,
    subtotal: 49.8,
  },
  {
    productId: 20,
    name: 'Refrigerante Lata',
    imageUrl: `${IMAGES}/refrigerante-lata.webp`,
    quantity: 1,
    unitPrice: 6.9,
    subtotal: 6.9,
  },
]

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
    totalAmount: 56.7,
    itemCount: 2,
    items: orderItems.map(({ productId, name, imageUrl, quantity }) => ({
      productId,
      name,
      imageUrl,
      quantity,
    })),
    deliveryAddress,
    createdAt: '2026-10-17T15:30:00Z',
    updatedAt: '2026-10-17T15:30:00Z',
  }
}

export function orderDetail(id: number, status: OrderStatus): OrderDetail {
  const { id: _id, itemCount, items, ...summary } = orderSummary(id, status)
  void itemCount
  void items
  return {
    id,
    ...summary,
    items: orderItems,
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
