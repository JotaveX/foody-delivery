import { Link, useSearchParams } from 'react-router'
import { ProductImage } from '../components/ProductImage'
import { QueryState } from '../components/QueryState'
import { StatusBadge } from '../components/StatusBadge'
import { formatAddressSummary, formatBRL, formatDateTime } from '../lib/format'
import { OrderActions } from './OrderActions'
import { useOrders } from './queries'
import { ORDER_STATUSES, STATUS_LABEL } from './status'
import type { OrderItemPreview, OrderStatus } from './types'

export const PAGE_SIZE = 10
const MAX_THUMBNAILS = 4

export function OrdersPage() {
  // Filter and page live in the URL, so they survive reloads and the back button.
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
    const search = new URLSearchParams()
    if (merged.status) search.set('status', merged.status)
    if (merged.page > 0) search.set('page', String(merged.page))
    setParams(search)
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Pedidos</h1>
          <p className="muted">Acompanhe e atualize o status dos pedidos.</p>
        </div>
        <Link to="/orders/new" className="button-primary button-link">
          Novo pedido
        </Link>
      </div>

      <div className="toolbar">
        <label className="field field-inline">
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
          <ul className="order-list" aria-busy={isPlaceholderData}>
            {data?.content.map((order) => (
              <li key={order.id} className="card order-card" aria-label={`Pedido #${order.id}`}>
                <div className="order-card-main">
                  <div className="order-card-title">
                    <Link to={`/orders/${order.id}`}>#{order.id}</Link>
                    <span>{order.customerName}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="muted">{formatAddressSummary(order.deliveryAddress)}</p>
                  <ItemThumbnails items={order.items} />
                  <p className="order-card-meta">
                    <strong>{formatBRL(order.totalAmount)}</strong>
                    <span className="muted">
                      {order.itemCount} {order.itemCount === 1 ? 'item' : 'itens'} ·{' '}
                      {formatDateTime(order.createdAt)}
                    </span>
                  </p>
                </div>
                <OrderActions orderId={order.id} status={order.status} />
              </li>
            ))}
          </ul>
        )}

        {data && data.totalPages > 1 && (
          <nav className="pagination" aria-label="Paginação">
            <button
              type="button"
              className="button-ghost"
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
              className="button-ghost"
              disabled={page + 1 >= data.totalPages || isPlaceholderData}
              onClick={() => update({ page: page + 1 })}
            >
              Próxima
            </button>
          </nav>
        )}
      </QueryState>
    </section>
  )
}

function ItemThumbnails({ items }: { items: OrderItemPreview[] }) {
  const hidden = items.length - MAX_THUMBNAILS
  return (
    <ul className="item-thumbnails" aria-label="Itens">
      {items.slice(0, MAX_THUMBNAILS).map((item) => (
        <li key={item.productId} title={`${item.quantity}× ${item.name}`}>
          <ProductImage
            src={item.imageUrl}
            alt={`${item.quantity}× ${item.name}`}
            width={40}
            height={40}
            className="thumbnail"
          />
        </li>
      ))}
      {hidden > 0 && <li className="item-thumbnails-more">+{hidden}</li>}
    </ul>
  )
}
