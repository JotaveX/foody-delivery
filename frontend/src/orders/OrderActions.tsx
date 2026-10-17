import { useCallback, useState } from 'react'
import { toApiError } from '../api/problem'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NEXT_STATUSES, TRANSITION_LABEL } from './status'
import { useChangeOrderStatus } from './queries'
import type { OrderStatus } from './types'

interface OrderActionsProps {
  orderId: number
  status: OrderStatus
}

/** Buttons for the transitions allowed from the current status; cancelling asks first. */
export function OrderActions({ orderId, status }: OrderActionsProps) {
  const mutation = useChangeOrderStatus()
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const next = NEXT_STATUSES[status]

  const change = (target: OrderStatus) =>
    mutation.mutate(
      { id: orderId, status: target },
      { onSettled: () => setConfirmingCancel(false) },
    )

  const closeDialog = useCallback(() => setConfirmingCancel(false), [])

  if (next.length === 0) return null

  return (
    <div className="order-actions">
      <div className="order-actions-buttons">
        {next.map((target) => (
          <button
            key={target}
            type="button"
            className={target === 'CANCELADO' ? 'button-ghost button-ghost-danger' : 'button-ghost'}
            disabled={mutation.isPending}
            onClick={() => {
              mutation.reset()
              if (target === 'CANCELADO') setConfirmingCancel(true)
              else change(target)
            }}
          >
            {TRANSITION_LABEL[target]}
          </button>
        ))}
      </div>
      {mutation.error && (
        <p role="alert" className="field-error">
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
