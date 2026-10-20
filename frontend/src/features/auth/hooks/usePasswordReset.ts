import { useMutation } from '@tanstack/react-query'
import { requestPasswordReset, resetPassword } from '../api/passwordReset'

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (email: string) => requestPasswordReset(email) })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      resetPassword(token, password),
  })
}
