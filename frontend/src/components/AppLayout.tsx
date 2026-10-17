import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'

export function AppLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Foody
        </Link>
        <nav className="app-nav" aria-label="Principal">
          <NavLink to="/orders">Pedidos</NavLink>
          <NavLink to="/addresses">Endereços</NavLink>
        </nav>
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
