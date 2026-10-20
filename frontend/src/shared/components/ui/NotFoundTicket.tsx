import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface NotFoundTicketProps {
  title: string
  /** Left side of the ticket header, e.g. "COMANDA Nº 404". */
  reference: string
  children: ReactNode
  actionTo: string
  actionLabel: string
}

/** A ticket stamped "Extraviada": something that was looked for and is not there. */
export function NotFoundTicket({
  title,
  reference,
  children,
  actionTo,
  actionLabel,
}: NotFoundTicketProps) {
  return (
    <div className="auth-ticket not-found-ticket">
      <div className="paper">
        <div className="ticket-meta label">
          <span>{reference}</span>
          <span>NÃO ENCONTRADA</span>
        </div>
        <h1>{title}</h1>
        <span className="stamp stamp-cancelado not-found-stamp" aria-hidden="true">
          Extraviada
        </span>
        <hr className="rule" />
        <div className="not-found-body">{children}</div>
        <hr className="rule" />
        <Link to={actionTo} className="btn btn-brand btn-block">
          {actionLabel} <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="tear" aria-hidden="true" />
    </div>
  )
}
