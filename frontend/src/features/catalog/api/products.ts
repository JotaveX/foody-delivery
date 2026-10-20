import { api } from '@/shared/lib/api/client'
import type { Product } from '../types'

export async function listProducts() {
  return (await api.get<Product[]>('/products')).data
}
