import { QueryClient } from '@tanstack/react-query'
import axios from 'axios'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // 4xx answers (404, 401…) will not change on retry; network/5xx get one more try.
        retry: (failureCount, error) =>
          failureCount < 1 && !(axios.isAxiosError(error) && (error.response?.status ?? 500) < 500),
      },
    },
  })
}
