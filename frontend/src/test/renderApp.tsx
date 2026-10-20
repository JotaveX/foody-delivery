import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '@/app/AppRoutes'
import { RetryExhaustedRedirect } from '@/app/RetryExhaustedRedirect'
import { AuthProvider } from '@/features/auth'
import { shouldRetry } from '@/shared/lib/retryPolicy'

interface RenderAppOptions {
  /** Use the app's retry policy (without the waits) and its redirect to the error page. */
  retryPolicy?: boolean
}

/** Renders the whole app (routes + auth + a fresh query cache) at the given path. */
export function renderApp(path = '/', { retryPolicy = false }: RenderAppOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: retryPolicy ? { retry: shouldRetry, retryDelay: 0 } : { retry: false },
      mutations: { retry: false },
    },
  })
  return {
    user: userEvent.setup(),
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            {retryPolicy && <RetryExhaustedRedirect />}
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}
