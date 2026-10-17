import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../AppRoutes'
import { AuthProvider } from '../auth/AuthProvider'

/** Renders the whole app (routes + auth) at the given path. */
export function renderApp(path = '/') {
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    ),
  }
}
