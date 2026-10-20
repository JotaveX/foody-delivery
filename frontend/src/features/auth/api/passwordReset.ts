import { api } from '@/shared/lib/api/client'

/** Always resolves (204) for a valid e-mail, registered or not. */
export async function requestPasswordReset(email: string) {
  await api.post('/auth/forgot-password', { email })
}

export async function resetPassword(token: string, password: string) {
  await api.post('/auth/reset-password', { token, password })
}
