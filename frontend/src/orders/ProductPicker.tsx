import { useState } from 'react'
import { CATEGORIES, CATEGORY_LABEL } from '../catalog/categories'
import type { Product, ProductCategory } from '../catalog/types'
import { ProductImage } from '../components/ProductImage'
import { formatBRL } from '../lib/format'
import { MAX_QUANTITY, type Cart } from './cart'

interface ProductPickerProps {
  products: Product[]
  cart: Cart
  onQuantityChange: (productId: number, quantity: number) => void
}

/** Catalog grid by category, with a quantity stepper on each product. */
export function ProductPicker({ products, cart, onQuantityChange }: ProductPickerProps) {
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
                  onQuantityChange={(quantity) => onQuantityChange(product.id, quantity)}
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
  onQuantityChange: (quantity: number) => void
}

function ProductCard({ product, quantity, onQuantityChange }: ProductCardProps) {
  return (
    <li
      className={`product-card${quantity > 0 ? ' product-card-selected' : ''}`}
      aria-label={product.name}
    >
      <ProductImage
        src={product.imageUrl}
        alt=""
        width={320}
        height={240}
        className="product-card-image"
      />
      <div className="product-card-body">
        <h4>{product.name}</h4>
        <p className="muted">{product.description}</p>
      </div>
      <div className="product-card-footer">
        <strong>{formatBRL(product.price)}</strong>
        <div className="stepper">
          <button
            type="button"
            aria-label={`Diminuir ${product.name}`}
            disabled={quantity === 0}
            onClick={() => onQuantityChange(quantity - 1)}
          >
            −
          </button>
          <output aria-label={`Quantidade de ${product.name}`}>{quantity}</output>
          <button
            type="button"
            aria-label={`Adicionar ${product.name}`}
            disabled={quantity >= MAX_QUANTITY}
            onClick={() => onQuantityChange(quantity + 1)}
          >
            +
          </button>
        </div>
      </div>
    </li>
  )
}
