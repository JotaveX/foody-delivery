import { createContext, useContext } from 'react'

/** State of the real-time connection to the order updates topic. */
export type LiveStatus = 'connecting' | 'live' | 'reconnecting'

/** While the socket is down, order queries fall back to polling at this interval. */
export const OFFLINE_POLL_INTERVAL_MS = 15_000

export const LiveStatusContext = createContext<LiveStatus | null>(null)

/**
 * `refetchInterval` for order queries: none while live updates flow, polling otherwise. Outside a
 * provider (no socket at all) it does not poll.
 */
export function useOfflinePollInterval() {
  const status = useContext(LiveStatusContext)
  return status === null || status === 'live' ? false : OFFLINE_POLL_INTERVAL_MS
}
