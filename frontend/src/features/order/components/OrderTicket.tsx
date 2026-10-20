import { Link } from 'react-router'
import { formatAmount, formatBRL } from '@/shared/utils/format'
import { formatAgo, formatDuration } from '@/shared/utils/time'
import { OrderActions } from './OrderActions'
import { isStalled, minutesInStatus } from '../model/timing'
import type { OrderSummary } from '../types'

/** One order as a paper ticket on the board. */
export function OrderTicket({ order, now }: { order: OrderSummary; now: Date }) {
  const stalled = isStalled(order, now)
  return (
    <li className="ticket" aria-label={`Pedido #${order.id}`}>
      <div className="paper ticket-body">
        {stalled && (
          <p className="ticket-late">
            <span>PARADO HÁ {formatDuration(minutesInStatus(order, now)).toUpperCase()}</span>
          </p>
        )}
        <div className="ticket-head">
          <Link to={`/orders/${order.id}`} className="ticket-number">
            #{order.id}
          </Link>
          <time className="ticket-age" dateTime={order.createdAt}>
            {formatAgo(order.createdAt, now)}
          </time>
        </div>
        <div className="ticket-who">
          <span className="ticket-customer">{order.customerName}</span>
          <span className="ticket-place">{order.deliveryAddress.neighborhood}</span>
        </div>
        <hr className="rule" />
        <ul className="ticket-lines" aria-label="Itens">
          {order.items.map((item) => (
            <li key={item.productId} className="ticket-line">
              <span>
                {item.quantity}x {item.name}
              </span>
              <span className="dots" aria-hidden="true" />
              <span>{formatAmount(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <hr className="rule" />
        <p className="ticket-total">
          <span>TOTAL</span>
          <span>{formatBRL(order.totalAmount)}</span>
        </p>
        <OrderActions orderId={order.id} status={order.status} />
      </div>
      <div className="tear" aria-hidden="true" />
    </li>
  )
}
