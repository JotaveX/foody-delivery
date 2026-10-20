import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter } from 'react-router'
import { AppRoutes } from './AppRoutes'
import { RetryExhaustedRedirect } from './RetryExhaustedRedirect'
import { AuthProvider } from '@/features/auth'
import { createQueryClient } from '@/shared/lib/queryClient'

export default function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <RetryExhaustedRedirect />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
