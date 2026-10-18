import type { ReactNode } from 'react'
import { HAPPY_PATH, STATUS_LABEL } from '../orders/status'

/** Auth screens: the wordmark and the order flow on the left, a paper ticket with the form. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <p className="auth-wordmark">FOODY</p>
        <ol className="auth-flow" aria-label="Etapas de um pedido">
          {HAPPY_PATH.map((status, index) => (
            <li key={status}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>{' '}
              {STATUS_LABEL[status].toUpperCase()}
            </li>
          ))}
        </ol>
      </div>
      <div className="auth-ticket">
        <div className="paper">
          <div className="ticket-meta label" aria-hidden="true">
            <span>COMANDA Nº ———</span>
            <span>EXPEDIÇÃO</span>
          </div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          <hr className="rule" />
          {children}
        </div>
        <div className="tear" aria-hidden="true" />
      </div>
    </div>
  )
}
