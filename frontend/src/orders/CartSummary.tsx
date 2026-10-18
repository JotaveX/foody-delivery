import { formatBRL } from '../lib/format'
import { cartTotal, type CartLine } from './cart'

interface CartSummaryProps {
  lines: CartLine[]
  error: string | null
  isSubmitting: boolean
}

/** Sticky order summary: beside the catalog on desktop, at the bottom of the screen on mobile. */
export function CartSummary({ lines, error, isSubmitting }: CartSummaryProps) {
  const empty = lines.length === 0
  return (
    <aside className="card cart-summary" aria-labelledby="cart-title">
      <h2 id="cart-title">Seu pedido</h2>
      {empty ? (
        <p className="muted cart-empty">Nenhum item ainda. Escolha produtos no cardápio.</p>
      ) : (
        <ul className="cart-lines" aria-label="Itens do pedido">
          {lines.map(({ product, quantity, subtotal }) => (
            <li key={product.id} className="cart-line" aria-label={product.name}>
              <span className="cart-line-name">
                {quantity}× {product.name}
              </span>
              <span className="cart-line-subtotal">{formatBRL(subtotal)}</span>
              <span className="muted cart-line-unit">{formatBRL(product.price)} cada</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="field-error">{error}</p>}
      <p className="order-total" aria-live="polite">
        Total: <strong data-testid="order-total">{formatBRL(cartTotal(lines))}</strong>
      </p>
      <button
        type="submit"
        className="button-primary"
        disabled={empty || isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Criando pedido…' : 'Criar pedido'}
      </button>
      {empty && <p className="field-hint">Adicione ao menos um item para criar o pedido.</p>}
    </aside>
  )
}
