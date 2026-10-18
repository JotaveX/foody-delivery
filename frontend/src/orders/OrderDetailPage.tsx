import axios from 'axios'
import { Link, useParams } from 'react-router'
import { ProductImage } from '../components/ProductImage'
import { QueryState } from '../components/QueryState'
import { StatusBadge } from '../components/StatusBadge'
import { formatBRL, formatDateTime, formatZipCode } from '../lib/format'
import { OrderActions } from './OrderActions'
import { useOrder, useOrderHistory } from './queries'
import { STATUS_LABEL } from './status'

export function OrderDetailPage() {
  const id = Number(useParams().id)
  const order = useOrder(id)
  const history = useOrderHistory(id)

  const notFound =
    !Number.isInteger(id) ||
    (axios.isAxiosError(order.error) && order.error.response?.status === 404)
  if (notFound) {
    return (
      <section className="empty-state">
        <h1>Pedido não encontrado</h1>
        <Link to="/orders">Voltar para os pedidos</Link>
      </section>
    )
  }

  return (
    <section>
      <Link to="/orders" className="back-link">
        ← Pedidos
      </Link>
      <QueryState
        isPending={order.isPending}
        error={order.error}
        loadingText="Carregando pedido…"
        onRetry={() => order.refetch()}
      >
        {order.data && (
          <>
            <div className="page-header">
              <div>
                <h1>
                  Pedido #{order.data.id} <StatusBadge status={order.data.status} />
                </h1>
                <p className="muted">
                  {order.data.customerName} · criado em {formatDateTime(order.data.createdAt)} por{' '}
                  {order.data.createdBy.name}
                </p>
              </div>
              <OrderActions orderId={order.data.id} status={order.data.status} />
            </div>

            <div className="detail-grid">
              <section className="card" aria-labelledby="items-title">
                <h2 id="items-title">Itens</h2>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Qtd.</th>
                      <th scope="col">Unitário</th>
                      <th scope="col">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.data.items.map((item) => (
                      <tr key={item.productId}>
                        <td>
                          <span className="item-cell">
                            <ProductImage
                              src={item.imageUrl}
                              alt=""
                              width={48}
                              height={48}
                              className="thumbnail"
                            />
                            {item.name}
                          </span>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{formatBRL(item.unitPrice)}</td>
                        <td>{formatBRL(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={3}>
                        Total
                      </th>
                      <td>
                        <strong>{formatBRL(order.data.totalAmount)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              <section className="card" aria-labelledby="address-title">
                <h2 id="address-title">Endereço de entrega</h2>
                {(() => {
                  const a = order.data.deliveryAddress
                  return (
                    <address className="delivery-address">
                      {a.label && <strong>{a.label}</strong>}
                      <span>
                        {a.street}, {a.number}
                        {a.complement ? ` — ${a.complement}` : ''}
                      </span>
                      <span>
                        {a.neighborhood}, {a.city}/{a.state}
                      </span>
                      <span>CEP {formatZipCode(a.zipCode)}</span>
                    </address>
                  )
                })()}
              </section>
            </div>

            <section className="card" aria-labelledby="history-title">
              <h2 id="history-title">Histórico</h2>
              <QueryState
                isPending={history.isPending}
                error={history.error}
                loadingText="Carregando histórico…"
                onRetry={() => history.refetch()}
              >
                <ol className="timeline">
                  {history.data?.map((entry, index) => (
                    <li key={index}>
                      <StatusBadge status={entry.toStatus} />
                      <span>
                        {entry.fromStatus
                          ? `${STATUS_LABEL[entry.fromStatus]} → ${STATUS_LABEL[entry.toStatus]}`
                          : 'Pedido criado'}
                      </span>
                      <span className="muted">
                        {formatDateTime(entry.changedAt)} · {entry.changedBy.name}
                      </span>
                    </li>
                  ))}
                </ol>
              </QueryState>
            </section>
          </>
        )}
      </QueryState>
    </section>
  )
}
