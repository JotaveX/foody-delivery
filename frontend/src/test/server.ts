import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const emptyPage = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }

/** Baseline handlers; tests override them with server.use(). */
export const server = setupServer(
  http.get('/api/orders', () => HttpResponse.json(emptyPage)),
  // No refresh cookie in tests unless one sets up /auth/refresh.
  http.post('/api/auth/refresh', () =>
    HttpResponse.json(
      { status: 401, detail: 'Sessão expirada. Faça login novamente.' },
      { status: 401 },
    ),
  ),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
)
