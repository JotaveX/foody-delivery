import { useCallback, useState } from 'react'
import { toApiError } from '@/shared/lib/api/problem'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { NEXT_STATUSES, TRANSITION_LABEL, TRANSITION_SHORT_LABEL } from '../model/status'
import { useChangeOrderStatus } from '../hooks/queries'
import type { OrderStatus } from '../types'

interface OrderActionsProps {
  orderId: number
  status: OrderStatus
  /** "ticket": compact buttons on paper; "detail": the large buttons beside the order. */
  variant?: 'ticket' | 'detail'
  className?: string
}

/**
 * The next step of the order as the main button ("Iniciar preparo →") and, when allowed, a neutral
 * "Cancelar" that asks first.
 */
export function OrderActions({
  orderId,
  status,
  variant = 'ticket',
  className = 'ticket-actions',
}: OrderActionsProps) {
  const mutation = useChangeOrderStatus()
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const next = NEXT_STATUSES[status]
  const forward = next.find((s) => s !== 'CANCELADO')
  const canCancel = next.includes('CANCELADO')
  const detail = variant === 'detail'

  const change = (target: OrderStatus) =>
    mutation.mutate(
      { id: orderId, status: target },
      { onSettled: () => setConfirmingCancel(false) },
    )

  const closeDialog = useCallback(() => setConfirmingCancel(false), [])

  if (next.length === 0) return null

  return (
    <div className={className}>
      {forward && (
        <button
          type="button"
          className={detail ? 'btn btn-brand btn-lg' : 'btn btn-ink'}
          disabled={mutation.isPending}
          aria-busy={mutation.isPending && !confirmingCancel}
          onClick={() => {
            mutation.reset()
            change(forward)
          }}
        >
          {(detail ? TRANSITION_LABEL : TRANSITION_SHORT_LABEL)[forward]}{' '}
          <span aria-hidden="true">→</span>
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          className={detail ? 'btn btn-outline btn-lg' : 'btn btn-outline'}
          aria-label={detail ? undefined : `Cancelar pedido #${orderId}`}
          disabled={mutation.isPending}
          onClick={() => {
            mutation.reset()
            setConfirmingCancel(true)
          }}
        >
          {(detail ? TRANSITION_LABEL : TRANSITION_SHORT_LABEL).CANCELADO}
        </button>
      )}
      {mutation.error && (
        <p role="alert" className="action-error">
          {toApiError(mutation.error).message}
        </p>
      )}
      {confirmingCancel && (
        <ConfirmDialog
          title={`Cancelar o pedido #${orderId}?`}
          confirmLabel="Cancelar pedido"
          cancelLabel="Voltar"
          busyLabel="Cancelando…"
          busy={mutation.isPending}
          onConfirm={() => change('CANCELADO')}
          onCancel={closeDialog}
        >
          <p>O cancelamento não pode ser desfeito.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
