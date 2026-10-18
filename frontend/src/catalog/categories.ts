import type { ProductCategory } from './types'

/** Menu order, as in the backend enum. */
export const CATEGORIES: ProductCategory[] = [
  'LANCHES',
  'PIZZA',
  'BRASILEIRA',
  'JAPONESA',
  'SALGADOS',
  'SOBREMESAS_BEBIDAS',
]

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  LANCHES: 'Lanches',
  PIZZA: 'Pizza',
  BRASILEIRA: 'Brasileira e marmitas',
  JAPONESA: 'Japonesa',
  SALGADOS: 'Salgados',
  SOBREMESAS_BEBIDAS: 'Sobremesas e bebidas',
}
