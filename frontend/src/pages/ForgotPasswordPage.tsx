import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { AuthCard, useRequestPasswordReset } from '@/features/auth'
import { Field } from '@/shared/components/ui/Field'
import { FormAlert } from '@/shared/components/ui/FormAlert'
import { toApiError } from '@/shared/lib/api/problem'

const forgotSchema = z.object({
  email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
})

type ForgotForm = z.infer<typeof forgotSchema>

export function ForgotPasswordPage() {
  const [apiError, setApiError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const requestReset = useRequestPasswordReset()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setApiError(null)
    try {
      await requestReset.mutateAsync(email)
      setSent(true)
    } catch (error) {
      setApiError(toApiError(error).message)
    }
  })

  return (
    <AuthCard
      title="Esqueci a senha"
      subtitle="Enviamos por e-mail um link para criar uma nova senha. Ele vale por 30 minutos."
    >
      {sent ? (
        // The API answers the same for unknown e-mails, so the message cannot say more than this.
        <p role="status" className="notice">
          Se houver uma conta com esse e-mail, você vai receber o link em instantes.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="form">
          <FormAlert message={apiError} />
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            registration={register('email')}
            error={errors.email}
          />
          <button
            type="submit"
            className="btn btn-brand btn-block"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              'Enviando…'
            ) : (
              <>
                Enviar link <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>
      )}
      <p className="auth-switch">
        Lembrou a senha? <Link to="/login">Entrar</Link>
      </p>
    </AuthCard>
  )
}
