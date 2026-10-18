import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  registration: UseFormRegisterReturn
  error?: FieldError
  hint?: string
  className?: string
  /** Shown on the label's line, at the right (e.g. "Esqueceu a senha?"). */
  labelAction?: ReactNode
}

export function Field({
  label,
  registration,
  error,
  hint,
  className,
  labelAction,
  ...input
}: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error?.message ?? hint
  const labelElement = <label htmlFor={id}>{label}</label>
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      {labelAction ? (
        <div className="field-label-row">
          {labelElement}
          {labelAction}
        </div>
      ) : (
        labelElement
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...input}
        {...registration}
      />
      {message && (
        <span id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {message}
        </span>
      )}
    </div>
  )
}
