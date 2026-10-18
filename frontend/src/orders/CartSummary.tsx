import { formatAmount, formatBRL } from '../lib/format'
import { cartTotal, type CartLine } from './cart'

interface CartSummaryProps {
  lines: CartLine[]
  error: string | null
  isSubmitting: boolean
}

/** The ticket being written: beside the catalog on desktop, at the bottom of the screen on mobile. */
export function CartSummary({ lines, error, isSubmitting }: CartSummaryProps) {
  const empty = lines.length === 0
  return (
    <aside className="cart-summary" aria-labelledby="cart-title">
      <div className="paper">
        <div className="ticket-meta label" aria-hidden="true">
          <span>COMANDA Nº ———</span>
          <span>NOVA</span>
        </div>
        <h2 id="cart-title">Seu pedido</h2>
        <hr className="rule" />
        {empty ? (
          <p className="cart-empty">Nenhum item ainda. Escolha produtos no cardápio.</p>
        ) : (
          <ul className="cart-lines" aria-label="Itens do pedido">
            {lines.map(({ product, quantity, subtotal }) => (
              <li key={product.id} aria-label={product.name}>
                <span className="ticket-line">
                  <span>
                    {quantity}x {product.name}
                  </span>
                  <span className="dots" aria-hidden="true" />
                  <span>{formatAmount(subtotal)}</span>
                </span>
                <span className="cart-line-unit">un. {formatBRL(product.price)}</span>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="field-error">{error}</p>}
        <hr className="rule" />
        <p className="order-total" aria-live="polite">
          <span>TOTAL</span>
          <strong data-testid="order-total">{formatBRL(cartTotal(lines))}</strong>
        </p>
        <button
          type="submit"
          className="btn btn-brand btn-block"
          disabled={empty || isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            'Criando pedido…'
          ) : (
            <>
              Criar pedido <span aria-hidden="true">→</span>
            </>
          )}
        </button>
        {empty && <p className="field-hint">Adicione ao menos um item para criar o pedido.</p>}
      </div>
      <div className="tear" aria-hidden="true" />
    </aside>
  )
}
