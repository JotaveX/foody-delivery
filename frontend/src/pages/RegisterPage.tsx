import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch, type Path } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { toApiError } from '../api/problem'
import { useAuth } from '../auth/useAuth'
import { AuthCard } from '../components/AuthCard'
import { Field } from '../components/Field'
import { FormAlert } from '../components/FormAlert'
import { lookupCep } from '../lib/viacep'

const required = (message: string) => z.string().trim().min(1, message)

const registerSchema = z
  .object({
    name: required('Informe o nome.').max(100, 'O nome deve ter no máximo 100 caracteres.'),
    email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
    password: z
      .string()
      .min(8, 'A senha deve ter no mínimo 8 caracteres.')
      .max(72, 'A senha deve ter no máximo 72 caracteres.'),
    confirmPassword: z.string(),
    address: z.object({
      zipCode: z
        .string()
        .trim()
        .regex(/^\d{5}-?\d{3}$/, 'Informe um CEP com 8 dígitos.'),
      street: required('Informe a rua.'),
      number: required('Informe o número.'),
      complement: z.string().trim().max(100, 'Máximo de 100 caracteres.'),
      neighborhood: required('Informe o bairro.'),
      city: required('Informe a cidade.'),
      state: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{2}$/, 'Use a sigla com 2 letras.'),
      label: z.string().trim().max(30, 'Máximo de 30 caracteres.'),
    }),
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
  address: {
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    label: '',
  },
}

export function RegisterPage() {
  const { register: signUp, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [apiError, setApiError] = useState<string | null>(null)
  // Last finished CEP lookup; the status shown for the current CEP is derived from it.
  const [cepLookup, setCepLookup] = useState<{ cep: string; found: boolean } | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues })

  const zipDigits = useWatch({ control, name: 'address.zipCode' }).replace(/\D/g, '')
  const cepStatus =
    zipDigits.length !== 8
      ? 'idle'
      : cepLookup?.cep !== zipDigits
        ? 'loading'
        : cepLookup.found
          ? 'idle'
          : 'not-found'

  useEffect(() => {
    if (zipDigits.length !== 8) return
    const controller = new AbortController()
    lookupCep(zipDigits, controller.signal).then((found) => {
      if (controller.signal.aborted) return
      setCepLookup({ cep: zipDigits, found: found !== null })
      if (!found) return
      const options = { shouldValidate: true, shouldDirty: true }
      setValue('address.street', found.street, options)
      setValue('address.neighborhood', found.neighborhood, options)
      setValue('address.city', found.city, options)
      setValue('address.state', found.state, options)
      setFocus(found.street ? 'address.number' : 'address.street')
    })
    return () => controller.abort()
  }, [zipDigits, setValue, setFocus])

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const onSubmit = handleSubmit(async ({ name, email, password, address }) => {
    setApiError(null)
    try {
      await signUp({
        name,
        email,
        password,
        address: {
          ...address,
          state: address.state.toUpperCase(),
          label: address.label || undefined,
          complement: address.complement || undefined,
        },
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

  const cepHint =
    cepStatus === 'loading'
      ? 'Buscando endereço…'
      : cepStatus === 'not-found'
        ? 'CEP não encontrado. Preencha o endereço manualmente.'
        : 'O endereço é preenchido automaticamente.'

  return (
    <AuthCard title="Criar conta" subtitle="Cadastre-se e informe onde quer receber seus pedidos.">
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
          <Field
            label="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={9}
            registration={register('address.zipCode')}
            error={errors.address?.zipCode}
            hint={cepHint}
            className="field-narrow"
          />
          <div className="field-row field-row-wide">
            <Field
              label="Rua"
              autoComplete="address-line1"
              registration={register('address.street')}
              error={errors.address?.street}
            />
            <Field
              label="Número"
              registration={register('address.number')}
              error={errors.address?.number}
            />
          </div>
          <Field
            label="Complemento (opcional)"
            autoComplete="address-line2"
            registration={register('address.complement')}
            error={errors.address?.complement}
          />
          <Field
            label="Bairro"
            registration={register('address.neighborhood')}
            error={errors.address?.neighborhood}
          />
          <div className="field-row field-row-wide">
            <Field
              label="Cidade"
              autoComplete="address-level2"
              registration={register('address.city')}
              error={errors.address?.city}
            />
            <Field
              label="UF"
              autoComplete="address-level1"
              maxLength={2}
              registration={register('address.state')}
              error={errors.address?.state}
            />
          </div>
          <Field
            label="Apelido do endereço (opcional)"
            placeholder="Casa, Trabalho…"
            registration={register('address.label')}
            error={errors.address?.label}
          />
        </fieldset>

        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
      <p className="auth-switch">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthCard>
  )
}
