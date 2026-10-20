import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { QueryState } from '@/shared/components/ui/QueryState'
import { formatDuration, isSameDay, useNow } from '@/shared/utils/time'
import { OrderTicket } from './OrderTicket'
import { useOrders } from '../hooks/queries'
import { OPEN_STATUSES, STATUS_LABEL } from '../model/status'
import { STALLED_AFTER_MINUTES, isStalled, totalMinutes } from '../model/timing'
import type { OrderStatus, OrderSummary, Page } from '../types'

/** The API maximum: one request per column fetches everything a kitchen has open. */
export const BOARD_PAGE_SIZE = 100
const DONE_SHOWN = 8

const COLUMN_TITLE: Partial<Record<OrderStatus, string>> = {
  SAIU_PARA_ENTREGA: 'Saiu p/ entrega',
}

const oldestFirst = (a: OrderSummary, b: OrderSummary) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

/** Kitchen board: one column per open status, plus the orders delivered today. */
export function OrdersBoard({ viewToggle }: { viewToggle: ReactNode }) {
  const now = useNow()
  const received = useOrders({ status: 'RECEBIDO', page: 0, size: BOARD_PAGE_SIZE })
  const preparing = useOrders({ status: 'EM_PREPARO', page: 0, size: BOARD_PAGE_SIZE })
  const outForDelivery = useOrders({
    status: 'SAIU_PARA_ENTREGA',
    page: 0,
    size: BOARD_PAGE_SIZE,
  })
  const delivered = useOrders({ status: 'ENTREGUE', page: 0, size: BOARD_PAGE_SIZE })
  const open = [received, preparing, outForDelivery]
  const all = [...open, delivered]

  const openPages = open.map((q) => q.data).filter((p): p is Page<OrderSummary> => !!p)
  const openCount = openPages.reduce((sum, p) => sum + p.totalElements, 0)
  const stalledCount = openPages
    .flatMap((p) => p.content)
    .filter((order) => isStalled(order, now)).length
  const deliveredToday = (delivered.data?.content ?? []).filter((o) => isSameDay(o.updatedAt, now))

  const loaded = all.every((q) => q.data)

  return (
    <>
      <div className="board-bar">
        {loaded ? <BoardStats openCount={openCount} stalledCount={stalledCount} /> : <span />}
        {viewToggle}
      </div>
      <QueryState
        isPending={all.some((q) => q.isPending)}
        error={all.find((q) => q.error)?.error}
        loadingText="Carregando o quadro…"
        onRetry={() => all.forEach((q) => q.refetch())}
      >
        <div className="board" aria-busy={all.some((q) => q.isPlaceholderData)}>
          {OPEN_STATUSES.map((status, index) => (
            <BoardColumn key={status} status={status} page={open[index].data} now={now} />
          ))}
          <DeliveredColumn orders={deliveredToday} />
        </div>
      </QueryState>
    </>
  )
}

function BoardStats({ openCount, stalledCount }: { openCount: number; stalledCount: number }) {
  return (
    <ul className="board-stats" aria-label="Resumo">
      <li>
        <strong>{openCount}</strong> {openCount === 1 ? 'aberto' : 'abertos'}
      </li>
      {stalledCount > 0 && (
        <li className="alert">
          <strong>{stalledCount}</strong> {stalledCount === 1 ? 'pedido parado' : 'pedidos parados'}{' '}
          há mais de {STALLED_AFTER_MINUTES} min
        </li>
      )}
    </ul>
  )
}

function BoardColumn({
  status,
  page,
  now,
}: {
  status: OrderStatus
  page: Page<OrderSummary> | undefined
  now: Date
}) {
  const titleId = `column-${status}`
  const orders = [...(page?.content ?? [])].sort(oldestFirst)
  const hidden = (page?.totalElements ?? 0) - orders.length
  return (
    <section className="board-column" aria-labelledby={titleId}>
      <div className="section-head">
        <h2 id={titleId}>
          <span aria-hidden="true">{COLUMN_TITLE[status] ?? STATUS_LABEL[status]}</span>
          <span className="sr-only">{STATUS_LABEL[status]}</span>
        </h2>
        <span className="count">{page?.totalElements ?? 0}</span>
      </div>
      {orders.length === 0 ? (
        <p className="column-empty">Nenhum pedido</p>
      ) : (
        <ul className="ticket-list">
          {orders.map((order) => (
            <OrderTicket key={order.id} order={order} now={now} />
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <Link to={`/orders?view=lista&status=${status}`} className="column-more">
          +{hidden} fora do quadro · ver na lista
        </Link>
      )}
    </section>
  )
}

function DeliveredColumn({ orders }: { orders: OrderSummary[] }) {
  return (
    <section className="board-column board-column-done" aria-labelledby="column-delivered">
      <div className="section-head">
        <h2 id="column-delivered">Entregue hoje</h2>
        <span className="count">{orders.length}</span>
      </div>
      {orders.length === 0 ? (
        <p className="column-empty">Nenhuma entrega hoje</p>
      ) : (
        <ul className="done-list">
          {orders.slice(0, DONE_SHOWN).map((order) => (
            <li key={order.id}>
              <Link to={`/orders/${order.id}`} className="done-row">
                <span>
                  <strong>#{order.id}</strong> {order.customerName}
                </span>
                <span className="muted" title="Do pedido à entrega">
                  {formatDuration(totalMinutes(order))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/orders?view=lista&status=ENTREGUE" className="more-link">
        Ver todos os entregues <span aria-hidden="true">&nbsp;→</span>
      </Link>
    </section>
  )
}
