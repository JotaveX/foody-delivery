import { Link, useLocation } from 'react-router'
import { StampedTicket } from '@/shared/components/ui/StampedTicket'
import { MAX_RETRIES } from '@/shared/lib/retryPolicy'
import { HAPPY_PATH, STATUS_LABEL } from '@/features/order'

/** Set by RetryExhaustedRedirect: where the user was and how the server last answered. */
export interface ServerErrorState {
  from?: string
  status?: number
}

/** Where the app lands when a screen could not load after every retry. Works logged in or out. */
export function ServerErrorPage() {
  const state = (useLocation().state ?? {}) as ServerErrorState
  // Only paths inside the app: never an absolute or protocol-relative URL.
  const from = state.from?.startsWith('/') && !state.from.startsWith('//') ? state.from : '/'
  const code = state.status ?? null
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <Link to="/" className="brand" aria-label="Foody, quadro de pedidos">
          <span className="brand-name">FOODY</span>
          <span className="brand-sub">/ EXPEDIÇÃO</span>
        </Link>
        <p className="auth-wordmark" aria-hidden="true">
          {code ?? 'OFF'}
        </p>
        <ol className="auth-flow server-error-flow" aria-label="Etapas de um pedido">
          {HAPPY_PATH.map((status, index) => (
            <li key={status}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>{' '}
              {STATUS_LABEL[status].toUpperCase()}
            </li>
          ))}
          <li className="server-error-step">
            <strong>!!</strong> SEM RESPOSTA
          </li>
        </ol>
      </div>
      <StampedTicket
        title="Servidor indisponível"
        reference={`COMANDA Nº ${code ?? '———'}`}
        status="SEM RESPOSTA"
        stamp="Fora do ar"
        actionTo={from}
        actionLabel="Tentar novamente"
      >
        <p className="label">Tentativas</p>
        <p className="stamped-ticket-value">
          {MAX_RETRIES + 1} de {MAX_RETRIES + 1}
        </p>
        <p className="muted">
          {code === null
            ? 'Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.'
            : 'O servidor não conseguiu atender agora. Aguarde um instante e tente de novo.'}
        </p>
      </StampedTicket>
    </div>
  )
}
