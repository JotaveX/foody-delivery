import { useQuery } from '@tanstack/react-query'
import { listProducts } from '../api/products'

export const productKeys = { all: ['products'] as const }

/** The whole catalog in one request (20 products); categories are filtered on the client. */
export function useProducts() {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: listProducts,
    // Practically immutable: the API also sends Cache-Control: max-age=300.
    staleTime: 5 * 60 * 1000,
  })
}
