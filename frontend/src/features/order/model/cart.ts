import type { Product } from '@/features/catalog'

/** Quantity per productId. Products with quantity 0 are not kept. */
export type Cart = ReadonlyMap<number, number>

export const MAX_QUANTITY = 999

export interface CartLine {
  product: Product
  quantity: number
  subtotal: number
}

export function setQuantity(cart: Cart, productId: number, quantity: number): Cart {
  const next = new Map(cart)
  const clamped = Math.min(Math.max(quantity, 0), MAX_QUANTITY)
  if (clamped === 0) next.delete(productId)
  else next.set(productId, clamped)
  return next
}

/** Lines in menu order. Amounts are summed in cents so the total never drifts (0.1 + 0.2). */
export function cartLines(cart: Cart, products: Product[]): CartLine[] {
  return products
    .filter((p) => cart.has(p.id))
    .map((product) => {
      const quantity = cart.get(product.id)!
      return { product, quantity, subtotal: (toCents(product.price) * quantity) / 100 }
    })
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((cents, line) => cents + toCents(line.subtotal), 0) / 100
}

const toCents = (amount: number) => Math.round(amount * 100)
