import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import {
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
  type Path,
  type Resolver,
} from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { AddressFields } from '../addresses/AddressFields'
import {
  addressSchema,
  emptyAddress,
  toAddressInput,
  type AddressFormValues,
} from '../addresses/addressSchema'
import { addressKeys, useAddresses } from '../addresses/useAddresses'
import { toApiError } from '../api/problem'
import type { Address } from '../auth/types'
import { useAuth } from '../auth/useAuth'
import { Field } from '../components/Field'
import { FormAlert } from '../components/FormAlert'
import { QueryState } from '../components/QueryState'
import { formatBRL, formatZipCode } from '../lib/format'
import { createOrder, type CreateOrderInput } from './api'
import { orderKeys } from './queries'

/** Select value meaning "type a new address" instead of a saved one. */
const NEW_ADDRESS = 'new'

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6

const itemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o item.')
    .max(100, 'O nome do item deve ter no máximo 100 caracteres.'),
  quantity: z
    .number({ error: 'Informe a quantidade.' })
    .int('Use um número inteiro.')
    .min(1, 'A quantidade mínima é 1.')
    .max(999, 'A quantidade máxima é 999.'),
  unitPrice: z
    .number({ error: 'Informe o preço.' })
    .positive('O preço deve ser maior que zero.')
    .refine(hasAtMostTwoDecimals, 'Use no máximo 2 casas decimais.'),
})

const baseSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, 'Informe o nome do cliente.')
    .max(100, 'O nome do cliente deve ter no máximo 100 caracteres.'),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item.'),
  addressChoice: z.string().min(1, 'Escolha um endereço.'),
  saveAsDefault: z.boolean(),
})

// The typed address is only validated when the user chose to type one.
const withSavedAddress = baseSchema.extend({ address: z.custom<AddressFormValues>() })
const withNewAddress = baseSchema.extend({ address: addressSchema })

type NewOrderForm = z.infer<typeof withNewAddress>

const savedResolver = zodResolver(withSavedAddress) as unknown as Resolver<NewOrderForm>
const newResolver = zodResolver(withNewAddress) as unknown as Resolver<NewOrderForm>
const resolver: Resolver<NewOrderForm> = (values, context, options) =>
  values.addressChoice === NEW_ADDRESS
    ? newResolver(values, context, options)
    : savedResolver(values, context, options)

const emptyItem = { name: '', quantity: 1, unitPrice: undefined as unknown as number }

export function NewOrderPage() {
  const addresses = useAddresses()
  return (
    <section>
      <Link to="/orders" className="back-link">
        ← Pedidos
      </Link>
      <h1>Novo pedido</h1>
      <QueryState
        isPending={addresses.isPending}
        error={addresses.error}
        loadingText="Carregando seus endereços…"
        onRetry={() => addresses.refetch()}
      >
        {addresses.data && <NewOrderFormView addresses={addresses.data} />}
      </QueryState>
    </section>
  )
}

function NewOrderFormView({ addresses }: { addresses: Address[] }) {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState<string | null>(null)
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0]

  const form = useForm<NewOrderForm>({
    resolver,
    defaultValues: {
      customerName: user?.name ?? '',
      items: [emptyItem],
      addressChoice: defaultAddress ? String(defaultAddress.id) : NEW_ADDRESS,
      address: emptyAddress,
      saveAsDefault: false,
    },
  })
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' })
  const addressChoice = useWatch({ control, name: 'addressChoice' })
  const selectedAddress = addresses.find((a) => String(a.id) === addressChoice)

  const total = items.reduce((sum, item) => {
    const subtotal = Number(item.quantity) * Number(item.unitPrice)
    return Number.isFinite(subtotal) ? sum + subtotal : sum
  }, 0)

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: async (_order, input) => {
      const createdAddress = 'newAddress' in input
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        createdAddress && queryClient.invalidateQueries({ queryKey: addressKeys.all }),
        createdAddress && input.saveAsDefault && refreshUser().catch(() => {}),
      ])
      navigate('/orders')
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null)
    const base = {
      customerName: values.customerName,
      items: values.items.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })),
    }
    const input: CreateOrderInput =
      values.addressChoice === NEW_ADDRESS
        ? {
            ...base,
            newAddress: toAddressInput(values.address),
            saveAsDefault: values.saveAsDefault,
          }
        : { ...base, addressId: Number(values.addressChoice) }
    try {
      await mutation.mutateAsync(input)
    } catch (error) {
      const { message, fieldErrors } = toApiError(error)
      setApiError(message)
      for (const [field, fieldMessage] of Object.entries(fieldErrors)) {
        setError(toFormPath(field), { message: fieldMessage })
      }
    }
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="form order-form">
        <FormAlert message={apiError} />

        <section className="card">
          <Field
            label="Cliente"
            registration={register('customerName')}
            error={errors.customerName}
          />
        </section>

        <section className="card" aria-labelledby="order-items-title">
          <h2 id="order-items-title">Itens</h2>
          <ol className="item-rows">
            {fields.map((field, index) => {
              const item = items[index]
              const subtotal = Number(item?.quantity) * Number(item?.unitPrice)
              return (
                <li key={field.id} className="item-row" aria-label={`Item ${index + 1}`}>
                  <Field
                    label="Item"
                    registration={register(`items.${index}.name`)}
                    error={errors.items?.[index]?.name}
                  />
                  <Field
                    label="Qtd."
                    type="number"
                    min={1}
                    step={1}
                    registration={register(`items.${index}.quantity`, { valueAsNumber: true })}
                    error={errors.items?.[index]?.quantity}
                  />
                  <Field
                    label="Preço (R$)"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    registration={register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                    error={errors.items?.[index]?.unitPrice}
                  />
                  <div className="item-row-end">
                    <span className="item-subtotal">
                      {formatBRL(Number.isFinite(subtotal) ? subtotal : 0)}
                    </span>
                    <button
                      type="button"
                      className="button-ghost button-ghost-danger"
                      aria-label={`Remover item ${index + 1}`}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
          {errors.items?.root?.message && (
            <p className="field-error">{errors.items.root.message}</p>
          )}
          <div className="items-footer">
            <button type="button" className="button-ghost" onClick={() => append(emptyItem)}>
              Adicionar item
            </button>
            <p className="order-total" aria-live="polite">
              Total: <strong data-testid="order-total">{formatBRL(total)}</strong>
            </p>
          </div>
        </section>

        <section className="card" aria-labelledby="order-address-title">
          <h2 id="order-address-title">Entrega</h2>
          <div className="field">
            <label htmlFor="address-choice">Endereço de entrega</label>
            <select
              id="address-choice"
              {...register('addressChoice')}
              aria-invalid={errors.addressChoice ? true : undefined}
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ?? 'Endereço'} — {a.street}, {a.number}
                  {a.isDefault ? ' (padrão)' : ''}
                </option>
              ))}
              <option value={NEW_ADDRESS}>Usar outro endereço…</option>
            </select>
            {errors.addressChoice && (
              <span className="field-error">{errors.addressChoice.message}</span>
            )}
          </div>

          {addressChoice === NEW_ADDRESS ? (
            <>
              <AddressFields />
              <label className="checkbox">
                <input type="checkbox" {...register('saveAsDefault')} />
                Definir como padrão
              </label>
            </>
          ) : (
            selectedAddress && <SavedAddressFields address={selectedAddress} />
          )}
        </section>

        <div className="form-actions">
          <Link to="/orders" className="button-ghost button-link">
            Cancelar
          </Link>
          <button type="submit" className="button-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Criando pedido…' : 'Criar pedido'}
          </button>
        </div>
      </form>
    </FormProvider>
  )
}

/** The selected saved address, shown read-only (addresses are edited on /addresses). */
function SavedAddressFields({ address }: { address: Address }) {
  const fields: [string, string][] = [
    ['CEP', formatZipCode(address.zipCode)],
    ['Rua', address.street],
    ['Número', address.number],
    ['Complemento', address.complement ?? ''],
    ['Bairro', address.neighborhood],
    ['Cidade', address.city],
    ['UF', address.state],
  ]
  return (
    <div className="saved-address">
      {fields.map(([label, value]) => (
        <ReadOnlyField key={label} label={label} value={value} />
      ))}
      <p className="field-hint">
        Para alterar este endereço, use <Link to="/addresses">Meus endereços</Link>.
      </p>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} readOnly />
    </div>
  )
}

/** Maps API field names (items[0].name, newAddress.street, addressId) to form paths. */
function toFormPath(field: string): Path<NewOrderForm> {
  if (field === 'addressId') return 'addressChoice'
  return field
    .replace(/^newAddress\./, 'address.')
    .replace(/\[(\d+)\]/g, '.$1') as Path<NewOrderForm>
}
