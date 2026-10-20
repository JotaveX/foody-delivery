import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { AuthCard, passwordSchema, useResetPassword } from '@/features/auth'
import { Field } from '@/shared/components/ui/Field'
import { FormAlert } from '@/shared/components/ui/FormAlert'
import { toApiError } from '@/shared/lib/api/problem'

const resetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

type ResetForm = z.infer<typeof resetSchema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Read once: the token is then dropped from the address bar (history, screenshots, Referer).
  const [token] = useState(() => searchParams.get('token'))
  const [apiError, setApiError] = useState<string | null>(null)
  const reset = useResetPassword()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (searchParams.has('token')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  if (!token) {
    return (
      <AuthCard title="Redefinir senha" subtitle="Este link está incompleto.">
        <FormAlert message="Link de redefinição inválido. Solicite um novo." />
        <p className="auth-switch">
          <Link to="/forgot-password">Pedir um novo link</Link>
        </p>
      </AuthCard>
    )
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setApiError(null)
    try {
      await reset.mutateAsync({ token, password })
      navigate('/login', {
        replace: true,
        state: { notice: 'Senha redefinida. Entre com a nova senha.' },
      })
    } catch (error) {
      setApiError(toApiError(error).message)
    }
  })

  return (
    <AuthCard title="Redefinir senha">
      <form onSubmit={onSubmit} noValidate className="form">
        <FormAlert message={apiError} />
        <Field
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          registration={register('password')}
          error={errors.password}
        />
        <Field
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          registration={register('confirmPassword')}
          error={errors.confirmPassword}
        />
        <button
          type="submit"
          className="btn btn-brand btn-block"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            'Salvando…'
          ) : (
            <>
              Salvar nova senha <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </form>
      <p className="auth-switch">
        Link expirado? <Link to="/forgot-password">Pedir um novo</Link>
      </p>
    </AuthCard>
  )
}
