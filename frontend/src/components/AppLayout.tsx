import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { LiveStatusContext } from '../orders/liveStatus'
import { useOrderUpdates } from '../orders/useOrderUpdates'

export function AppLayout() {
  const { user, token, logout } = useAuth()
  const liveStatus = useOrderUpdates(token)
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Foody
        </Link>
        <nav className="app-nav" aria-label="Principal">
          <NavLink to="/orders">Pedidos</NavLink>
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
        <LiveStatusContext.Provider value={liveStatus}>
          <Outlet />
        </LiveStatusContext.Provider>
      </main>
    </div>
  )
}
