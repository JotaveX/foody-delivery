import { Link, Outlet, useMatch } from 'react-router'
import { useAuth } from '@/features/auth'
import { formatClock, useNow } from '@/shared/utils/time'
import { LiveStatusContext, useOrderUpdates } from '@/features/order'

export function AppLayout() {
  const { user, isAuthenticated, logout } = useAuth()
  const liveStatus = useOrderUpdates(isAuthenticated)
  const now = useNow()
  const onNewOrder = useMatch('/orders/new')
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand" aria-label="Foody, quadro de pedidos">
          <span className="brand-name">FOODY</span>
          <span className="brand-sub">/ EXPEDIÇÃO</span>
        </Link>
        <div className="app-header-right">
          <time className="clock" dateTime={now.toISOString()}>
            {formatClock(now)}
          </time>
          <span className="app-user">
            <span>{user?.name}</span>
            <span aria-hidden="true">·</span>
            <button type="button" className="link-button" onClick={logout}>
              Sair
            </button>
          </span>
          {!onNewOrder && (
            <Link to="/orders/new" className="btn btn-brand">
              <span aria-hidden="true">+</span> Novo pedido
            </Link>
          )}
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
