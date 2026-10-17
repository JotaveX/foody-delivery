import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { FormProvider, useForm, useWatch, type Path, type Resolver } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { AddressFields } from '../addresses/AddressFields'
import {
  addressSchema,
  emptyAddress,
  toAddressInput,
  type AddressFormValues,
} from '../addresses/addressSchema'
import { toApiError } from '../api/problem'
import { useAuth } from '../auth/useAuth'
import { AuthCard } from '../components/AuthCard'
import { Field } from '../components/Field'
import { FormAlert } from '../components/FormAlert'

const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),
  email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
  password: z
    .string()
    .min(8, 'A senha deve ter no mínimo 8 caracteres.')
    .max(72, 'A senha deve ter no máximo 72 caracteres.'),
  confirmPassword: z.string(),
  skipAddress: z.boolean(),
})

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword
const passwordMismatch = { path: ['confirmPassword'], message: 'As senhas não conferem.' }

// The address is only validated when the user did not choose to add it later.
const withAddress = accountSchema
  .extend({ address: addressSchema })
  .refine(passwordsMatch, passwordMismatch)
const withoutAddress = accountSchema
  .extend({ address: z.custom<AddressFormValues>() })
  .refine(passwordsMatch, passwordMismatch)

type RegisterForm = z.infer<typeof withAddress>

const withAddressResolver = zodResolver(withAddress) as unknown as Resolver<RegisterForm>
const withoutAddressResolver = zodResolver(withoutAddress) as unknown as Resolver<RegisterForm>
const resolver: Resolver<RegisterForm> = (values, context, options) =>
  values.skipAddress
    ? withoutAddressResolver(values, context, options)
    : withAddressResolver(values, context, options)

const defaultValues: RegisterForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  skipAddress: false,
  address: emptyAddress,
}

export function RegisterPage() {
  const { register: signUp, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [apiError, setApiError] = useState<string | null>(null)
  const form = useForm<RegisterForm>({ resolver, defaultValues })
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = form
  const skipAddress = useWatch({ control, name: 'skipAddress' })

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const setSkipAddress = (skip: boolean) => {
    setValue('skipAddress', skip)
    if (skip) clearErrors('address')
  }

  const onSubmit = handleSubmit(async ({ name, email, password, skipAddress, address }) => {
    setApiError(null)
    try {
      await signUp({
        name,
        email,
        password,
        address: skipAddress ? undefined : toAddressInput(address),
      })
      navigate('/', { replace: true })
    } catch (error) {
      const { message, fieldErrors } = toApiError(error)
      setApiError(message)
      // The API reports nested fields as "address.street", which matches the form paths.
      for (const [field, fieldMessage] of Object.entries(fieldErrors)) {
        setError(field as Path<RegisterForm>, { message: fieldMessage })
      }
    }
  })

  return (
    <AuthCard title="Criar conta" subtitle="Cadastre-se e informe onde quer receber seus pedidos.">
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className="form">
          <FormAlert message={apiError} />

          <fieldset>
            <legend>Seus dados</legend>
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

          <fieldset>
            <legend>Endereço de entrega</legend>
            {skipAddress ? (
              <div className="address-skipped">
                <p>Sem problema: você cadastra o endereço quando fizer o primeiro pedido.</p>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => setSkipAddress(false)}
                >
                  Informar endereço agora
                </button>
              </div>
            ) : (
              <>
                <p className="field-hint">
                  Onde você quer receber seus pedidos. Ele será o seu endereço padrão.
                </p>
                <AddressFields />
                <button
                  type="button"
                  className="button-ghost address-skip"
                  onClick={() => setSkipAddress(true)}
                >
                  Cadastrar endereço depois
                </button>
              </>
            )}
          </fieldset>

          <button type="submit" className="button-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>
      </FormProvider>
      <p className="auth-switch">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthCard>
  )
}
