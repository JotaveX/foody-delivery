import type { OrderStatus } from './types'

export const ORDER_STATUSES: OrderStatus[] = [
  'RECEBIDO',
  'EM_PREPARO',
  'SAIU_PARA_ENTREGA',
  'ENTREGUE',
  'CANCELADO',
]

export const STATUS_LABEL: Record<OrderStatus, string> = {
  RECEBIDO: 'Recebido',
  EM_PREPARO: 'Em preparo',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

/**
 * Mirror of the backend state machine, used only to decide which buttons to show. The backend
 * stays the source of truth: if they ever disagree, its 409 is shown to the user.
 */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  RECEBIDO: ['EM_PREPARO', 'CANCELADO'],
  EM_PREPARO: ['SAIU_PARA_ENTREGA', 'CANCELADO'],
  SAIU_PARA_ENTREGA: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
}

/** Button label for moving an order *to* a status. */
export const TRANSITION_LABEL: Record<OrderStatus, string> = {
  RECEBIDO: 'Receber',
  EM_PREPARO: 'Iniciar preparo',
  SAIU_PARA_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Marcar como entregue',
  CANCELADO: 'Cancelar pedido',
}
