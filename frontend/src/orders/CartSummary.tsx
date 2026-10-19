import { useState } from 'react'
import { formatAmount, formatBRL } from '../lib/format'
import { cartTotal, MAX_QUANTITY, type CartLine } from './cart'

interface CartSummaryProps {
  lines: CartLine[]
  error: string | null
  /** On the menu step the ticket moves on to the delivery step; on the delivery one it submits. */
  step: 'menu' | 'delivery'
  isSubmitting: boolean
  onQuantityChange: (productId: number, quantity: number) => void
  onContinue: () => void
}

/**
 * The ticket being written: beside the catalog on desktop. On mobile it sticks to the bottom of the
 * screen and only exists while it has items: it slides in with the first one and slides out when
 * the last one is removed.
 */
export function CartSummary({
  lines,
  error,
  step,
  isSubmitting,
  onQuantityChange,
  onContinue,
}: CartSummaryProps) {
  const empty = lines.length === 0
  // Kept rendered while the exit animation plays after the last item is removed.
  const [leaving, setLeaving] = useState(false)
  const [wasEmpty, setWasEmpty] = useState(empty)
  if (wasEmpty !== empty) {
    setWasEmpty(empty)
    setLeaving(empty)
  }
  const presence = !empty ? 'open' : leaving ? 'leaving' : 'closed'

  return (
    <aside
      className="cart-summary"
      data-presence={presence}
      aria-labelledby="cart-title"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && empty) setLeaving(false)
      }}
    >
      <div className="paper">
        <div className="ticket-meta label" aria-hidden="true">
          <span>COMANDA Nº ———</span>
          <span>NOVA</span>
        </div>
        <h2 id="cart-title">Seu pedido</h2>
        <hr className="rule" />
        {empty ? (
          <p className="cart-empty">Nenhum item ainda. Toque nos produtos do cardápio.</p>
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
                <span className="cart-line-foot">
                  <span className="cart-line-unit">un. {formatBRL(product.price)}</span>
                  <span className="cart-stepper">
                    <button
                      type="button"
                      aria-label={
                        quantity === 1 ? `Remover ${product.name}` : `Diminuir ${product.name}`
                      }
                      onClick={() => onQuantityChange(product.id, quantity - 1)}
                    >
                      {quantity === 1 ? '×' : '−'}
                    </button>
                    <output aria-label={`Quantidade de ${product.name}`}>{quantity}</output>
                    <button
                      type="button"
                      aria-label={`Aumentar ${product.name}`}
                      disabled={quantity >= MAX_QUANTITY}
                      onClick={() => onQuantityChange(product.id, quantity + 1)}
                    >
                      +
                    </button>
                  </span>
                </span>
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
        {step === 'menu' ? (
          <button
            type="button"
            className="btn btn-brand btn-block"
            disabled={empty}
            onClick={onContinue}
          >
            Continuar <span aria-hidden="true">→</span>
          </button>
        ) : (
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
        )}
        {empty && <p className="field-hint">Adicione ao menos um item para continuar.</p>}
      </div>
      <div className="tear" aria-hidden="true" />
    </aside>
  )
}
