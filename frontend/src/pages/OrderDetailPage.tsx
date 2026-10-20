import axios from 'axios'
import { Link, useParams } from 'react-router'
import { StampedTicket } from '@/shared/components/ui/StampedTicket'
import { QueryState } from '@/shared/components/ui/QueryState'
import {
  StatusBadge,
  OrderActions,
  useOrder,
  useOrderHistory,
  HAPPY_PATH,
  STATUS_LABEL,
  isTerminal,
  minutesInStatus,
  totalMinutes,
  type HistoryEntry,
  type OrderDetail,
} from '@/features/order'
import { formatAmount, formatBRL, formatZipCode } from '@/shared/utils/format'
import {
  formatAgo,
  formatDateAndTime,
  formatDuration,
  formatTime,
  minutesBetween,
  useNow,
} from '@/shared/utils/time'

export function OrderDetailPage() {
  const id = Number(useParams().id)
  const order = useOrder(id)
  const history = useOrderHistory(id)
  const now = useNow()

  const notFound =
    !Number.isInteger(id) ||
    (axios.isAxiosError(order.error) && order.error.response?.status === 404)
  if (notFound) {
    return (
      <div className="not-found-inline">
        <StampedTicket
          title="Pedido não encontrado"
          reference={Number.isInteger(id) ? `COMANDA Nº ${id}` : 'COMANDA Nº ———'}
          status="NÃO ENCONTRADA"
          stamp="Extraviada"
          actionTo="/orders"
          actionLabel="Voltar para os pedidos"
        >
          <p className="muted">
            {Number.isInteger(id)
              ? `Não existe pedido com o número #${id}.`
              : 'O número do pedido no endereço não é válido.'}
          </p>
        </StampedTicket>
      </div>
    )
  }

  return (
    <div className="page-narrow">
      <Link to="/orders" className="back-link">
        ← Voltar ao quadro
      </Link>
      <QueryState
        isPending={order.isPending}
        error={order.error}
        loadingText="Carregando pedido…"
        onRetry={() => order.refetch()}
      >
        {order.data && (
          <div className="detail">
            <OrderSlip order={order.data} now={now} />

            <section className="detail-side" aria-label="Andamento">
              {isTerminal(order.data.status) ? (
                <p className="detail-closed">
                  Pedido encerrado: {STATUS_LABEL[order.data.status].toLowerCase()}{' '}
                  {formatAgo(order.data.updatedAt, now)}.
                </p>
              ) : (
                <OrderActions
                  orderId={order.data.id}
                  status={order.data.status}
                  variant="detail"
                  className="detail-actions"
                />
              )}

              <section className="timeline-section" aria-labelledby="timeline-title">
                <div className="section-head">
                  <h2 id="timeline-title">Linha do tempo</h2>
                </div>
                <QueryState
                  isPending={history.isPending}
                  error={history.error}
                  loadingText="Carregando histórico…"
                  onRetry={() => history.refetch()}
                >
                  {history.data && <Timeline order={order.data} entries={history.data} now={now} />}
                </QueryState>
              </section>

              <Metrics order={order.data} now={now} />
            </section>
          </div>
        )}
      </QueryState>
    </div>
  )
}

/** The order as a large paper ticket. */
function OrderSlip({ order, now }: { order: OrderDetail; now: Date }) {
  const a = order.deliveryAddress
  return (
    <article className="detail-ticket" aria-labelledby="order-title">
      <div className="paper">
        <div className="ticket-meta label">
          <span>COMANDA</span>
          <time dateTime={order.createdAt}>{formatDateAndTime(order.createdAt)}</time>
        </div>
        <div className="detail-head">
          <h1 id="order-title">
            <span className="sr-only">Pedido</span> #{order.id}
          </h1>
          <StatusBadge status={order.status} />
        </div>
        <div className="ticket-who">
          <span className="detail-customer">{order.customerName}</span>
          <span className="ticket-place">
            {isTerminal(order.status)
              ? `${STATUS_LABEL[order.status]} ${formatAgo(order.updatedAt, now)}`
              : `Aberto ${formatAgo(order.createdAt, now)}`}{' '}
            · registrado por {order.createdBy.name}
          </span>
        </div>
        <hr className="rule" />
        <table className="items-table">
          <caption className="sr-only">Itens</caption>
          <thead>
            <tr>
              <th scope="col">QTD</th>
              <th scope="col">ITEM</th>
              <th scope="col">VALOR</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.productId}>
                <td>{item.quantity}</td>
                <td>
                  {item.name}
                  <span className="unit">un. {formatBRL(item.unitPrice)}</span>
                </td>
                <td>{formatAmount(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="rule" />
        <p className="detail-total">
          <span>TOTAL</span>
          <span>{formatBRL(order.totalAmount)}</span>
        </p>
        <hr className="rule" />
        <section className="deliver-to" aria-labelledby="deliver-to-title">
          <h2 id="deliver-to-title" className="label">
            Entregar em
          </h2>
          <address>
            <span>
              {a.street}, {a.number}
              {a.complement ? ` — ${a.complement}` : ''}
              {a.label ? ` (${a.label})` : ''}
            </span>
            <span>
              {a.neighborhood}, {a.city}/{a.state} · CEP {formatZipCode(a.zipCode)}
            </span>
          </address>
        </section>
      </div>
      <div className="tear" aria-hidden="true" />
    </article>
  )
}

interface Step {
  key: string
  status: HistoryEntry['toStatus']
  kind: 'done' | 'current' | 'future' | 'cancelled'
  time?: string
  description?: string
  /** Time until the next recorded step ("+3 min"). */
  gap?: number
}

/**
 * What happened, with the time spent between steps, followed by the steps still ahead: the state
 * machine stays visible.
 */
function Timeline({
  order,
  entries,
  now,
}: {
  order: OrderDetail
  entries: HistoryEntry[]
  now: Date
}) {
  const open = !isTerminal(order.status)
  const steps: Step[] = entries.map((entry, index) => {
    const next = entries[index + 1]
    const last = index === entries.length - 1
    const what = entry.fromStatus
      ? `${STATUS_LABEL[entry.fromStatus]} → ${STATUS_LABEL[entry.toStatus]}`
      : 'Pedido criado'
    return {
      key: `${index}-${entry.toStatus}`,
      status: entry.toStatus,
      kind: entry.toStatus === 'CANCELADO' ? 'cancelled' : last && open ? 'current' : 'done',
      time: entry.changedAt,
      description:
        `${what} · ${entry.changedBy.name}` +
        (last && open ? ` · ${formatAgo(entry.changedAt, now)}` : ''),
      gap: next ? minutesBetween(entry.changedAt, next.changedAt) : undefined,
    }
  })
  if (open) {
    const ahead = HAPPY_PATH.slice(HAPPY_PATH.indexOf(order.status) + 1)
    ahead.forEach((status, index) =>
      steps.push({
        key: `next-${status}`,
        status,
        kind: 'future',
        description: index === 0 ? 'próxima etapa' : undefined,
      }),
    )
  }

  return (
    <ol className="timeline">
      {steps.map((step) => (
        <li key={step.key} className={`timeline-step timeline-step-${step.kind}`}>
          <span className="timeline-time">
            {step.time ? (
              <time dateTime={step.time}>{formatTime(step.time)}</time>
            ) : (
              <span aria-hidden="true">—</span>
            )}
          </span>
          <span className="timeline-rail" aria-hidden="true">
            <span className="timeline-mark" />
            <span className="timeline-line" />
          </span>
          <span className="timeline-event">
            <strong>{STATUS_LABEL[step.status]}</strong>
            {step.description && <span>{step.description}</span>}
            {step.gap !== undefined && (
              <span className="timeline-gap">+{formatDuration(step.gap)}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Metrics({ order, now }: { order: OrderDetail; now: Date }) {
  if (isTerminal(order.status)) {
    return (
      <ul className="metrics" aria-label="Tempos">
        <li>
          Do pedido {order.status === 'ENTREGUE' ? 'à entrega' : 'ao cancelamento'}{' '}
          <strong>{formatDuration(totalMinutes(order))}</strong>
        </li>
      </ul>
    )
  }
  return (
    <ul className="metrics" aria-label="Tempos">
      <li>
        {STATUS_LABEL[order.status]} há{' '}
        <strong>{formatDuration(minutesInStatus(order, now))}</strong>
      </li>
      <li>
        Desde o pedido <strong>{formatDuration(minutesBetween(order.createdAt, now))}</strong>
      </li>
    </ul>
  )
}
