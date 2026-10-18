import { Client, ReconnectionTimeMode } from '@stomp/stompjs'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { wsUrl } from '../api/endpoints'
import type { LiveStatus } from './liveStatus'
import { applyOrderUpdate } from './orderCache'
import { orderKeys } from './queries'
import type { OrderDetail } from './types'

export const ORDERS_TOPIC = '/topic/orders'

/**
 * Keeps the order cache in sync with the server over STOMP: every order change arrives on
 * {@link ORDERS_TOPIC} and is written straight into the cache (lists and detail). Reconnects with
 * exponential backoff; returns the connection state so the UI can show it and fall back to polling.
 *
 * The JWT goes in the CONNECT frame headers, not in the URL.
 */
export function useOrderUpdates(token: string | null): LiveStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')

  useEffect(() => {
    if (!token) return
    let connectedBefore = false
    const client = new Client({
      brokerURL: wsUrl(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 1_000,
      maxReconnectDelay: 30_000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      onConnect: () => {
        client.subscribe(ORDERS_TOPIC, (message) => {
          applyOrderUpdate(queryClient, JSON.parse(message.body) as OrderDetail)
        })
        // Changes made while we were offline were never pushed: catch up once.
        if (connectedBefore) void queryClient.invalidateQueries({ queryKey: orderKeys.all })
        connectedBefore = true
        setStatus('live')
      },
      onWebSocketClose: () => {
        if (client.active) setStatus('reconnecting')
      },
    })
    client.activate()
    return () => {
      void client.deactivate()
      setStatus('connecting')
    }
  }, [token, queryClient])

  return status
}
