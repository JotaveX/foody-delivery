import { useAuth } from '../auth/useAuth'

export function HomePage() {
  const { user } = useAuth()
  const address = user?.defaultAddress
  return (
    <section className="home">
      <h1>Seus pedidos</h1>
      <p className="muted">Você ainda não tem pedidos.</p>
      {address && (
        <div className="card">
          <p className="card-label">Entregar em{address.label ? ` · ${address.label}` : ''}</p>
          <p>
            {address.street}, {address.number}
            {address.complement ? ` — ${address.complement}` : ''}
          </p>
          <p className="muted">
            {address.neighborhood}, {address.city}/{address.state}
          </p>
        </div>
      )}
    </section>
  )
}
