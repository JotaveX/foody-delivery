export type ProductCategory =
  'LANCHES' | 'PIZZA' | 'BRASILEIRA' | 'JAPONESA' | 'SALGADOS' | 'SOBREMESAS_BEBIDAS'

export interface Product {
  id: number
  slug: string
  name: string
  description: string
  category: ProductCategory
  price: number
  imageUrl: string
}
