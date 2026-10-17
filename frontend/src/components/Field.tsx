import { useId, type InputHTMLAttributes } from 'react'
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  registration: UseFormRegisterReturn
  error?: FieldError
  hint?: string
  className?: string
}

export function Field({ label, registration, error, hint, className, ...input }: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error?.message ?? hint
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={id}>{label}</label>
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
