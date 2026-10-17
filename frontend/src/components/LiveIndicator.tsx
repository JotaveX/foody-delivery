import type { LiveStatus } from '../orders/liveStatus'

const LABEL: Record<LiveStatus, string> = {
  connecting: 'Conectando…',
  live: 'Ao vivo',
  reconnecting: 'Reconectando…',
}

export function LiveIndicator({ status }: { status: LiveStatus }) {
  return (
    <span
      className={`live-indicator live-${status}`}
      aria-live="polite"
      title={status === 'live' ? undefined : 'Atualizando a cada 15s até reconectar'}
    >
      <span className="live-dot" aria-hidden="true" />
      {LABEL[status]}
    </span>
  )
}
