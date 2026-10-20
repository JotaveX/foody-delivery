import { Link, useLocation } from 'react-router'
import { StampedTicket } from '@/shared/components/ui/StampedTicket'
import { HAPPY_PATH, STATUS_LABEL } from '@/features/order'

/** Any unknown URL. Lives outside the authenticated layout: it works logged in or out. */
export function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <Link to="/" className="brand" aria-label="Foody, quadro de pedidos">
          <span className="brand-name">FOODY</span>
          <span className="brand-sub">/ EXPEDIÇÃO</span>
        </Link>
        <p className="auth-wordmark" aria-hidden="true">
          404
        </p>
        <ol className="auth-flow not-found-flow" aria-label="Etapas de um pedido">
          {HAPPY_PATH.map((status, index) => (
            <li key={status}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>{' '}
              {STATUS_LABEL[status].toUpperCase()}
            </li>
          ))}
          <li className="not-found-step">
            <strong>??</strong> ESTA PÁGINA
          </li>
        </ol>
      </div>
      <StampedTicket
        title="Página não encontrada"
        reference="COMANDA Nº 404"
        status="NÃO ENCONTRADA"
        stamp="Extraviada"
        actionTo="/"
        actionLabel="Ir para o quadro"
      >
        <p className="label">Endereço</p>
        <p className="stamped-ticket-value">{pathname}</p>
        <p className="muted">Ela pode ter mudado de lugar ou nunca ter existido.</p>
      </StampedTicket>
    </div>
  )
}
