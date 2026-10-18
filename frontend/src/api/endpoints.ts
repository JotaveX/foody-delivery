// In production the SPA (Cloudflare Pages) and the API (api.foody.jotave.dev) live on different
// origins, set at build time. In dev both are unset and the Vite proxy serves /api and /ws.

/** Base URL for REST calls. */
export function apiUrl(): string {
  return import.meta.env.VITE_API_URL || '/api'
}

/** STOMP WebSocket URL. */
export function wsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/ws`
}
