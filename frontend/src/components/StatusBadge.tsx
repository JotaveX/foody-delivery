import { STATUS_LABEL } from '../orders/status'
import type { OrderStatus } from '../orders/types'

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase().replaceAll('_', '-')}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
