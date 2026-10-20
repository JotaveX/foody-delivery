import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { toApiError } from '@/shared/lib/api/problem'
import { passwordSchema, useAuth, AuthCard } from '@/features/auth'
import { Field } from '@/shared/components/ui/Field'
import { FormAlert } from '@/shared/components/ui/FormAlert'

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Informe o nome.')
      .max(100, 'O nome deve ter no máximo 100 caracteres.'),
    email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })

type RegisterForm = z.infer<typeof registerSchema>

const defaultValues: RegisterForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export function RegisterPage() {
  const { register: signUp, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues })

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setApiError(null)
    try {
      await signUp({ name, email, password })
      navigate('/', { replace: true })
    } catch (error) {
      const { message, fieldErrors } = toApiError(error)
      setApiError(message)
      for (const [field, fieldMessage] of Object.entries(fieldErrors)) {
        setError(field as Path<RegisterForm>, { message: fieldMessage })
      }
    }
  })

  return (
    <AuthCard title="Criar conta">
      <form onSubmit={onSubmit} noValidate className="form">
        <FormAlert message={apiError} />

        <fieldset>
          <legend className="sr-only">Seus dados</legend>
          <Field
            label="Nome"
            autoComplete="name"
            registration={register('name')}
            error={errors.name}
          />
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            registration={register('email')}
            error={errors.email}
          />
          <div className="field-row">
            <Field
              label="Senha"
              type="password"
              autoComplete="new-password"
              registration={register('password')}
              error={errors.password}
            />
            <Field
              label="Confirmar senha"
              type="password"
              autoComplete="new-password"
              registration={register('confirmPassword')}
              error={errors.confirmPassword}
            />
          </div>
        </fieldset>

        <button
          type="submit"
          className="btn btn-brand btn-block"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            'Criando conta…'
          ) : (
            <>
              Criar conta <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </form>
      <p className="auth-switch">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthCard>
  )
}
