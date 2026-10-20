import { useId, useState } from 'react'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Product,
  type ProductCategory,
  ProductImage,
} from '@/features/catalog'
import { formatBRL } from '@/shared/utils/format'
import { MAX_QUANTITY, type Cart } from '../model/cart'

interface ProductPickerProps {
  products: Product[]
  cart: Cart
  onAdd: (productId: number) => void
}

/** Catalog grid by category. Clicking a product adds one unit of it to the cart. */
export function ProductPicker({ products, cart, onAdd }: ProductPickerProps) {
  const [selected, setSelected] = useState<ProductCategory | null>(null)
  const categories = CATEGORIES.filter((c) => products.some((p) => p.category === c))
  const shown = selected ? [selected] : categories

  return (
    <div className="product-picker">
      <div className="category-chips" role="group" aria-label="Categorias">
        <button
          type="button"
          className="chip"
          aria-pressed={selected === null}
          onClick={() => setSelected(null)}
        >
          Todos
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className="chip"
            aria-pressed={selected === category}
            onClick={() => setSelected(category)}
          >
            {CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>

      {shown.map((category) => (
        <section
          key={category}
          className="product-section"
          aria-labelledby={`category-${category}`}
        >
          <h3 id={`category-${category}`}>{CATEGORY_LABEL[category]}</h3>
          <ul className="product-grid">
            {products
              .filter((p) => p.category === category)
              .map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={cart.get(product.id) ?? 0}
                  onAdd={() => onAdd(product.id)}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

interface ProductCardProps {
  product: Product
  quantity: number
  onAdd: () => void
}

/** The whole card adds one unit per click; lowering the quantity is done on the ticket. */
function ProductCard({ product, quantity, onAdd }: ProductCardProps) {
  const detailsId = useId()
  const full = quantity >= MAX_QUANTITY
  return (
    <li
      className={`paper product-card${quantity > 0 ? ' product-card-selected' : ''}`}
      aria-label={product.name}
    >
      <button
        type="button"
        className="product-card-button"
        aria-label={`Adicionar ${product.name}`}
        aria-describedby={detailsId}
        aria-disabled={full}
        onClick={() => {
          if (!full) onAdd()
        }}
      >
        <ProductImage
          src={product.imageUrl}
          alt=""
          width={320}
          height={240}
          className="product-card-image"
        />
        <span id={detailsId} className="product-card-details">
          <span className="product-card-body">
            <span className="product-card-name">{product.name}</span>
            <span className="product-card-description">{product.description}</span>
          </span>
          <span className="product-card-footer">
            <span className="product-price">{formatBRL(product.price)}</span>
            <span className="product-add" aria-hidden="true">
              {full ? 'Máximo' : 'Adicionar'}
            </span>
          </span>
        </span>
      </button>
      {quantity > 0 && (
        // Keyed by the quantity so every click replays the "stamp" animation.
        <span key={quantity} className="product-qty">
          {quantity}x<span className="sr-only"> no pedido</span>
        </span>
      )}
    </li>
  )
}
