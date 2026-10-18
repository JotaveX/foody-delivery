interface ImportMetaEnv {
  /** Production API origin, e.g. https://api.foody.jotave.dev. Unset in dev (Vite proxy). */
  readonly VITE_API_URL?: string
  /** Production STOMP endpoint, e.g. wss://api.foody.jotave.dev/ws. Unset in dev (Vite proxy). */
  readonly VITE_WS_URL?: string
}
