import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface StampedTicketProps {
  title: string
  /** Left side of the ticket header, e.g. "COMANDA Nº 404". */
  reference: string
  /** Right side of the ticket header, e.g. "NÃO ENCONTRADA". */
  status: string
  /** The rubber stamp across the ticket, e.g. "Extraviada". */
  stamp: string
  children: ReactNode
  actionTo: string
  actionLabel: string
}

/** A ticket stamped in red: something that was looked for and could not be served. */
export function StampedTicket({
  title,
  reference,
  status,
  stamp,
  children,
  actionTo,
  actionLabel,
}: StampedTicketProps) {
  return (
    <div className="auth-ticket">
      <div className="paper">
        <div className="ticket-meta label">
          <span>{reference}</span>
          <span>{status}</span>
        </div>
        <h1>{title}</h1>
        <span className="stamp stamp-cancelado stamped-ticket-stamp" aria-hidden="true">
          {stamp}
        </span>
        <hr className="rule" />
        <div className="stamped-ticket-body">{children}</div>
        <hr className="rule" />
        <Link to={actionTo} className="btn btn-brand btn-block">
          {actionLabel} <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="tear" aria-hidden="true" />
    </div>
  )
}
