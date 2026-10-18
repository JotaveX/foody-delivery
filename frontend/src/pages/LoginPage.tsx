import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { toApiError } from '../api/problem'
import { useAuth } from '../auth/useAuth'
import { AuthCard } from '../components/AuthCard'
import { Field } from '../components/Field'
import { FormAlert } from '../components/FormAlert'

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
  password: z.string().min(1, 'Informe a senha.'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const state = location.state as { from?: string; notice?: string } | null
  const from = state?.from ?? '/'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setApiError(null)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (error) {
      setApiError(toApiError(error).message)
    }
  })

  return (
    <AuthCard title="Entrar" subtitle="Acompanhe seus pedidos em tempo real.">
      {state?.notice && (
        <p role="status" className="notice">
          {state.notice}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="form">
        <FormAlert message={apiError} />
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          registration={register('email')}
          error={errors.email}
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="current-password"
          registration={register('password')}
          error={errors.password}
        />
        <Link to="/forgot-password" className="forgot-link">
          Esqueceu a senha?
        </Link>
        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="auth-switch">
        Não tem conta? <Link to="/register">Cadastre-se</Link>
      </p>
    </AuthCard>
  )
}
