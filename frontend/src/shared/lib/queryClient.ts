import { QueryClient } from '@tanstack/react-query'
import { retryDelay, shouldRetry } from './retryPolicy'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Network/5xx failures back off and try again; once they run out, the app shows the
        // error page (app/RetryExhaustedRedirect). Mutations are not retried: the forms show the
        // error and the user decides.
        retry: shouldRetry,
        retryDelay,
      },
    },
  })
}
