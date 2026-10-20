import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { isTransientError } from '@/shared/lib/retryPolicy'
import type { ServerErrorState } from '@/pages/ServerErrorPage'

export const SERVER_ERROR_PATH = '/error'

/**
 * Sends the user to the error page when a screen has nothing to show: a query on it failed with a
 * transient error after every retry (React Query only reports the error once retries run out).
 * Queries that still hold data, like a background refetch or poll, keep their screen.
 */
export function RetryExhaustedRedirect() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef(location)
  useEffect(() => {
    locationRef.current = location
  }, [location])

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'error') return
        const { query } = event
        if (!query.getObserversCount() || query.state.data !== undefined) return
        const { error } = event.action
        if (!isTransientError(error) || !axios.isAxiosError(error)) return

        // Back to a blank slate, so "Tentar novamente" shows the loading state, not this error.
        query.reset()
        const { pathname, search } = locationRef.current
        if (pathname === SERVER_ERROR_PATH) return
        const state: ServerErrorState = { from: pathname + search, status: error.response?.status }
        navigate(SERVER_ERROR_PATH, { replace: true, state })
      }),
    [queryClient, navigate],
  )

  return null
}
