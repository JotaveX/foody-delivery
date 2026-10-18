import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  busyLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Modal confirmation. Escape or the backdrop cancels; focus starts on the safe action. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel = 'Aguarde…',
  cancelLabel = 'Cancelar',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="paper">
          <h2 id={titleId}>{title}</h2>
          <div id={descriptionId}>{children}</div>
          <hr className="rule" />
          <div className="form-actions">
            <button ref={cancelRef} type="button" className="btn btn-outline" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className="btn btn-ink" disabled={busy} onClick={onConfirm}>
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
        <div className="tear" aria-hidden="true" />
      </div>
    </div>
  )
}
