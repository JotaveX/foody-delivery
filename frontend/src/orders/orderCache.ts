import type { QueryClient } from '@tanstack/react-query'
import type { OrderFilters } from './api'
import { orderKeys } from './queries'
import type { OrderDetail, OrderSummary, Page } from './types'

type ListKey = ReturnType<typeof orderKeys.list>

/**
 * Writes an order pushed by the server into the cache, without refetching: the detail entry is
 * replaced and every cached list page that shows the order is patched in place.
 *
 * Lists are newest first, so a brand new order goes on top of the first page of every list whose
 * filter it matches. When a status change makes an order leave or enter a filtered list, its exact
 * page cannot be known locally; that list is patched as well as possible and marked stale, so it
 * reloads the next time it is shown.
 */
export function applyOrderUpdate(queryClient: QueryClient, order: OrderDetail) {
  queryClient.setQueryData<OrderDetail>(orderKeys.detail(order.id), (cached) =>
    cached ? order : undefined,
  )
  // The status history is not part of the message; reload it only if someone is looking at it.
  void queryClient.invalidateQueries({ queryKey: orderKeys.history(order.id) })

  const summary = toSummary(order)
  for (const [key, page] of queryClient.getQueriesData<Page<OrderSummary>>({
    queryKey: [...orderKeys.all, 'list'],
  })) {
    if (!page) continue
    const filters = (key as ListKey)[2] as OrderFilters
    const { next, stale } = patchPage(page, filters, summary)
    if (next !== page) queryClient.setQueryData(key, next)
    if (stale)
      void queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' })
  }
}

function patchPage(
  page: Page<OrderSummary>,
  filters: OrderFilters,
  order: OrderSummary,
): { next: Page<OrderSummary>; stale: boolean } {
  const matches = !filters.status || filters.status === order.status
  const index = page.content.findIndex((o) => o.id === order.id)

  if (index >= 0 && matches) {
    return { next: { ...page, content: page.content.with(index, order) }, stale: false }
  }
  if (index >= 0) {
    // Left the filter: drop it from this page.
    const content = page.content.filter((o) => o.id !== order.id)
    return { next: withTotal(page, content, page.totalElements - 1), stale: true }
  }
  if (!matches) {
    return { next: page, stale: false }
  }
  const newest = page.content[0]
  if (page.page === 0 && (!newest || order.createdAt >= newest.createdAt)) {
    const content = [order, ...page.content].slice(0, page.size)
    return { next: withTotal(page, content, page.totalElements + 1), stale: false }
  }
  // Belongs to this filter somewhere we cannot see.
  return { next: page, stale: true }
}

function withTotal(page: Page<OrderSummary>, content: OrderSummary[], total: number) {
  const totalElements = Math.max(total, 0)
  return { ...page, content, totalElements, totalPages: Math.ceil(totalElements / page.size) }
}

function toSummary(order: OrderDetail): OrderSummary {
  const { items, createdBy, ...summary } = order
  void createdBy
  return { ...summary, itemCount: items.length }
}
