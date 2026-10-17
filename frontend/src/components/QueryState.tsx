import type { ReactNode } from 'react'
import { toApiError } from '../api/problem'

interface QueryStateProps {
  isPending: boolean
  error: unknown
  loadingText: string
  onRetry?: () => void
  children: ReactNode
}

/** Loading and error states shared by every data-driven screen. */
export function QueryState({ isPending, error, loadingText, onRetry, children }: QueryStateProps) {
  if (isPending) {
    return (
      <p className="muted" role="status" aria-busy="true">
        {loadingText}
      </p>
    )
  }
  if (error) {
    return (
      <div role="alert" className="form-alert state-error">
        <span>{toApiError(error).message}</span>
        {onRetry && (
          <button type="button" className="button-ghost" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
      </div>
    )
  }
  return <>{children}</>
}
