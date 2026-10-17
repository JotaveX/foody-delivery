import { Link, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'

export function AppLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Foody
        </Link>
        <div className="app-header-user">
          <span>
            Olá, <strong>{user?.name}</strong>
          </span>
          <button type="button" className="button-ghost" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
