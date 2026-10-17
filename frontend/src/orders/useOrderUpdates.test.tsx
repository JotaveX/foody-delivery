import { ReconnectionTimeMode } from '@stomp/stompjs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { FakeStompClient } from '../test/fakeStomp'
import { orderDetail, orderSummary } from '../test/orderFixtures'
import {
  LiveStatusContext,
  OFFLINE_POLL_INTERVAL_MS,
  useOfflinePollInterval,
  type LiveStatus,
} from './liveStatus'
import { orderKeys } from './queries'
import type { OrderDetail, OrderSummary, Page } from './types'
import { ORDERS_TOPIC, useOrderUpdates } from './useOrderUpdates'

const ALL = { page: 0, size: 10 }
const RECEIVED = { status: 'RECEBIDO' as const, page: 0, size: 10 }

function setup(token: string | null = 'jwt-token') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const hook = renderHook(({ token }) => useOrderUpdates(token), {
    wrapper,
    initialProps: { token },
  })
  return { queryClient, hook, client: () => FakeStompClient.latest! }
}

function listPage(content: OrderSummary[], totalElements = content.length): Page<OrderSummary> {
  return { content, page: 0, size: 10, totalElements, totalPages: Math.ceil(totalElements / 10) }
}

function connected(token?: string) {
  const ctx = setup(token)
  act(() => ctx.client().simulateConnect())
  return ctx
}

function push(client: FakeStompClient, order: OrderDetail) {
  act(() => client.deliver(ORDERS_TOPIC, order))
}

describe('useOrderUpdates', () => {
  it('connects to /ws with the token in the CONNECT headers and exponential backoff', () => {
    const { hook, client } = setup()

    expect(hook.result.current).toBe('connecting')
    expect(client().active).toBe(true)
    expect(client().config).toMatchObject({
      brokerURL: `ws://${window.location.host}/ws`,
      connectHeaders: { Authorization: 'Bearer jwt-token' },
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    })
    expect(client().config.brokerURL).not.toContain('jwt-token')

    act(() => client().simulateConnect())

    expect(hook.result.current).toBe('live')
    expect([...client().subscriptions.keys()]).toEqual([ORDERS_TOPIC])
  })

  it('does not connect without a token', () => {
    setup(null)
    expect(FakeStompClient.instances).toHaveLength(0)
  })

  it('writes a pushed order into the detail and list caches without refetching', () => {
    const { queryClient, client } = connected()
    queryClient.setQueryData(orderKeys.detail(7), orderDetail(7, 'RECEBIDO'))
    queryClient.setQueryData(
      orderKeys.list(ALL),
      listPage([orderSummary(8, 'RECEBIDO'), orderSummary(7, 'RECEBIDO')]),
    )

    push(client(), { ...orderDetail(7, 'EM_PREPARO'), updatedAt: '2026-10-17T16:00:00Z' })

    expect(queryClient.getQueryData<OrderDetail>(orderKeys.detail(7))?.status).toBe('EM_PREPARO')
    const list = queryClient.getQueryData<Page<OrderSummary>>(orderKeys.list(ALL))!
    expect(list.content.map((o) => [o.id, o.status])).toEqual([
      [8, 'RECEBIDO'],
      [7, 'EM_PREPARO'],
    ])
    expect(list.content[1]).toMatchObject({ itemCount: 2, updatedAt: '2026-10-17T16:00:00Z' })
    expect(list.content[1]).not.toHaveProperty('items')
    // Patched in place: nothing was invalidated, so nothing will refetch.
    expect(queryClient.getQueryState(orderKeys.list(ALL))?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(orderKeys.detail(7))?.isInvalidated).toBe(false)
  })

  it('does not create cache entries for orders nobody has loaded', () => {
    const { queryClient, client } = connected()

    push(client(), orderDetail(7, 'EM_PREPARO'))

    expect(queryClient.getQueryData(orderKeys.detail(7))).toBeUndefined()
  })

  it('puts a new order on top of the first page of the lists it matches', () => {
    const { queryClient, client } = connected()
    queryClient.setQueryData(orderKeys.list(ALL), listPage([orderSummary(1, 'ENTREGUE')]))
    queryClient.setQueryData(orderKeys.list(RECEIVED), listPage([]))
    const preparing = { status: 'EM_PREPARO' as const, page: 0, size: 10 }
    queryClient.setQueryData(orderKeys.list(preparing), listPage([]))

    push(client(), { ...orderDetail(2, 'RECEBIDO'), createdAt: '2026-10-17T17:00:00Z' })

    const all = queryClient.getQueryData<Page<OrderSummary>>(orderKeys.list(ALL))!
    expect(all.content.map((o) => o.id)).toEqual([2, 1])
    expect(all.totalElements).toBe(2)
    const received = queryClient.getQueryData<Page<OrderSummary>>(orderKeys.list(RECEIVED))!
    expect(received.content.map((o) => o.id)).toEqual([2])
    expect(
      queryClient.getQueryData<Page<OrderSummary>>(orderKeys.list(preparing))?.content,
    ).toEqual([])
  })

  it('drops an order from a filtered list it no longer matches and marks that list stale', () => {
    const { queryClient, client } = connected()
    queryClient.setQueryData(
      orderKeys.list(RECEIVED),
      listPage([orderSummary(8, 'RECEBIDO'), orderSummary(7, 'RECEBIDO')]),
    )

    push(client(), orderDetail(7, 'CANCELADO'))

    const list = queryClient.getQueryData<Page<OrderSummary>>(orderKeys.list(RECEIVED))!
    expect(list.content.map((o) => o.id)).toEqual([8])
    expect(list.totalElements).toBe(1)
    expect(queryClient.getQueryState(orderKeys.list(RECEIVED))?.isInvalidated).toBe(true)
  })

  it('reports reconnecting when the socket drops and catches up once it is back', () => {
    const { hook, queryClient, client } = connected()
    queryClient.setQueryData(orderKeys.list(ALL), listPage([]))

    act(() => client().simulateClose())
    expect(hook.result.current).toBe('reconnecting')

    act(() => client().simulateConnect())
    expect(hook.result.current).toBe('live')
    expect(client().subscriptions.has(ORDERS_TOPIC)).toBe(true)
    expect(queryClient.getQueryState(orderKeys.list(ALL))?.isInvalidated).toBe(true)
  })

  it('disconnects on unmount and reconnects with the new token on login', () => {
    const { hook } = connected('old-token')
    const first = FakeStompClient.latest!

    hook.rerender({ token: 'new-token' })

    expect(first.active).toBe(false)
    expect(FakeStompClient.latest).not.toBe(first)
    expect(FakeStompClient.latest!.config.connectHeaders).toEqual({
      Authorization: 'Bearer new-token',
    })

    hook.unmount()
    expect(FakeStompClient.latest!.active).toBe(false)
  })
})

describe('useOfflinePollInterval', () => {
  function intervalWhile(status: LiveStatus | null) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LiveStatusContext.Provider value={status}>{children}</LiveStatusContext.Provider>
    )
    return renderHook(() => useOfflinePollInterval(), { wrapper }).result.current
  }

  it('polls every 15s only while the socket is not live', () => {
    expect(intervalWhile('live')).toBe(false)
    expect(intervalWhile('reconnecting')).toBe(OFFLINE_POLL_INTERVAL_MS)
    expect(intervalWhile('connecting')).toBe(OFFLINE_POLL_INTERVAL_MS)
    expect(OFFLINE_POLL_INTERVAL_MS).toBe(15_000)
    expect(intervalWhile(null)).toBe(false)
  })
})
