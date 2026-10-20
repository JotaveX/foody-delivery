import { STATUS_LABEL } from '../model/status'
import type { OrderStatus } from '../types'

/** The status as a rubber stamp on the ticket. */
export function StatusBadge({ status, small = false }: { status: OrderStatus; small?: boolean }) {
  const classes = ['stamp', `stamp-${status.toLowerCase().replaceAll('_', '-')}`]
  if (small) classes.push('stamp-sm')
  return <span className={classes.join(' ')}>{STATUS_LABEL[status]}</span>
}
