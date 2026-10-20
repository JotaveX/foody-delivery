import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { QueryState } from '@/shared/components/ui/QueryState'
import {
  StatusBadge,
  OrderActions,
  OrdersBoard,
  useOrders,
  ORDER_STATUSES,
  STATUS_LABEL,
  type OrderStatus,
} from '@/features/order'
import { formatAddressSummary, formatBRL } from '@/shared/utils/format'
import { formatAgo, useNow } from '@/shared/utils/time'

export const PAGE_SIZE = 10

/** Board (default) or list, chosen in the URL so it survives reloads and the back button. */
export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'lista' ? 'lista' : 'quadro'

  const viewToggle = (
    <div className="view-toggle" role="group" aria-label="Modo de visualização">
      <button
        type="button"
        aria-pressed={view === 'quadro'}
        onClick={() => setParams(new URLSearchParams())}
      >
        Quadro
      </button>
      <button
        type="button"
        aria-pressed={view === 'lista'}
        onClick={() => setParams(new URLSearchParams({ view: 'lista' }))}
      >
        Lista
      </button>
    </div>
  )

  return (
    <section>
      <h1 className="sr-only">Pedidos</h1>
      {view === 'quadro' ? (
        <OrdersBoard viewToggle={viewToggle} />
      ) : (
        <OrdersList viewToggle={viewToggle} />
      )}
    </section>
  )
}

/** Every order, newest first, filterable by status and paginated by the API. */
function OrdersList({ viewToggle }: { viewToggle: ReactNode }) {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status = ORDER_STATUSES.includes(statusParam as OrderStatus)
    ? (statusParam as OrderStatus)
    : undefined
  const page = Math.max(0, Number(params.get('page')) || 0)
  const { data, error, isPending, isPlaceholderData, refetch } = useOrders({
    status,
    page,
    size: PAGE_SIZE,
  })

  const update = (next: { status?: string; page?: number }) => {
    const merged = { status: status ?? '', page, ...next }
    const search = new URLSearchParams({ view: 'lista' })
    if (merged.status) search.set('status', merged.status)
    if (merged.page > 0) search.set('page', String(merged.page))
    setParams(search)
  }

  return (
    <>
      <div className="board-bar">
        <label className="select-field">
          <span>Status</span>
          <select
            value={status ?? ''}
            onChange={(event) => update({ status: event.target.value, page: 0 })}
          >
            <option value="">Todos</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {viewToggle}
      </div>

      <QueryState
        isPending={isPending}
        error={error}
        loadingText="Carregando pedidos…"
        onRetry={() => refetch()}
      >
        {data && data.content.length === 0 ? (
          <div className="empty-state">
            <p>
              {status
                ? `Nenhum pedido com status "${STATUS_LABEL[status]}".`
                : 'Nenhum pedido ainda.'}
            </p>
            {!status && <Link to="/orders/new">Criar o primeiro pedido</Link>}
          </div>
        ) : (
          <ul className="order-rows" aria-busy={isPlaceholderData}>
            {data?.content.map((order) => (
              <li key={order.id} className="paper order-row" aria-label={`Pedido #${order.id}`}>
                <Link to={`/orders/${order.id}`} className="order-row-number">
                  #{order.id}
                </Link>
                <div className="order-row-who">
                  <span className="ticket-customer">{order.customerName}</span>
                  <span className="ticket-place">
                    {formatAddressSummary(order.deliveryAddress)}
                  </span>
                </div>
                <ul className="order-row-items" aria-label="Itens">
                  {order.items.map((item) => (
                    <li key={item.productId}>
                      {item.quantity}x {item.name}
                    </li>
                  ))}
                </ul>
                <div className="order-row-side">
                  <StatusBadge status={order.status} small />
                  <span className="mono">
                    <strong>{formatBRL(order.totalAmount)}</strong>{' '}
                    <time className="ticket-age" dateTime={order.createdAt}>
                      · {formatAgo(order.createdAt, now)}
                    </time>
                  </span>
                </div>
                <OrderActions
                  orderId={order.id}
                  status={order.status}
                  className="order-row-actions"
                />
              </li>
            ))}
          </ul>
        )}

        {data && data.totalPages > 1 && (
          <nav className="pagination" aria-label="Paginação">
            <button
              type="button"
              className="btn-quiet"
              disabled={page === 0}
              onClick={() => update({ page: page - 1 })}
            >
              Anterior
            </button>
            <span className="muted">
              Página {data.page + 1} de {data.totalPages}
            </span>
            <button
              type="button"
              className="btn-quiet"
              disabled={page + 1 >= data.totalPages || isPlaceholderData}
              onClick={() => update({ page: page + 1 })}
            >
              Próxima
            </button>
          </nav>
        )}
      </QueryState>
    </>
  )
}
