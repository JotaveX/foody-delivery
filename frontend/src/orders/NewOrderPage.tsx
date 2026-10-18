import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FormProvider, useForm, useWatch, type Path, type Resolver } from 'react-hook-form'
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
import { productKeys, useProducts } from '../catalog/useProducts'
import { Field } from '../components/Field'
import { FormAlert } from '../components/FormAlert'
import { QueryState } from '../components/QueryState'
import { formatZipCode } from '../lib/format'
import { createOrder, type CreateOrderInput } from './api'
import { CartSummary } from './CartSummary'
import { cartLines, setQuantity, type Cart } from './cart'
import { ProductPicker } from './ProductPicker'
import { orderKeys } from './queries'

/** Choice value meaning "register a new address" instead of using a saved one. */
const NEW_ADDRESS = 'new'

const baseSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, 'Informe o nome do cliente.')
    .max(100, 'O nome do cliente deve ter no máximo 100 caracteres.'),
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
  // The cart lives outside react-hook-form: it is driven by the catalog steppers, not by inputs.
  const [cart, setCart] = useState<Cart>(() => new Map())
  const [cartError, setCartError] = useState<string | null>(null)
  const products = useProducts()
  const lines = cartLines(cart, products.data ?? [])
  // One key per opening of the form: every retry of the submit sends the same one.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0]

  const form = useForm<NewOrderForm>({
    resolver,
    defaultValues: {
      customerName: user?.name ?? '',
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
  const addressChoice = useWatch({ control, name: 'addressChoice' })
  const hasAddresses = addresses.length > 0

  const changeQuantity = (productId: number, quantity: number) => {
    setCart((current) => setQuantity(current, productId, quantity))
    setCartError(null)
  }

  const mutation = useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input, idempotencyKey),
    onSuccess: async (_order, input) => {
      const createdAddress = 'newAddress' in input
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        createdAddress && queryClient.invalidateQueries({ queryKey: addressKeys.all }),
        // The default may have changed (asked for, or this was the user's first address).
        createdAddress && refreshUser().catch(() => {}),
      ])
      navigate('/orders')
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null)
    // Unreachable through the UI (the submit button is disabled, which also blocks submitting
    // with Enter), but an order without items must never be sent.
    if (lines.length === 0) return
    const base = {
      customerName: values.customerName,
      // Never the price: the server copies it from the catalog.
      items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
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
        if (field.startsWith('items')) {
          setCartError(fieldMessage)
        } else {
          setError(toFormPath(field), { message: fieldMessage })
        }
      }
      // A product may have left the catalog meanwhile (422): show the current one.
      if ('items' in fieldErrors) {
        void queryClient.invalidateQueries({ queryKey: productKeys.all })
      }
    }
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="form order-form">
        <FormAlert message={apiError} />

        <div className="order-layout">
          <div className="order-main">
            <section className="card">
              <Field
                label="Cliente"
                registration={register('customerName')}
                error={errors.customerName}
              />
            </section>

            <section className="card" aria-labelledby="order-menu-title">
              <h2 id="order-menu-title">Cardápio</h2>
              <QueryState
                isPending={products.isPending}
                error={products.error}
                loadingText="Carregando o cardápio…"
                onRetry={() => products.refetch()}
              >
                {products.data && (
                  <ProductPicker
                    products={products.data}
                    cart={cart}
                    onQuantityChange={changeQuantity}
                  />
                )}
              </QueryState>
            </section>

            <section className="card" aria-labelledby="order-address-title">
              <h2 id="order-address-title">Entrega</h2>
              {hasAddresses ? (
                <fieldset className="address-options">
                  <legend>Endereço de entrega</legend>
                  {addresses.map((a) => (
                    <label key={a.id} className="address-option">
                      <input type="radio" value={String(a.id)} {...register('addressChoice')} />
                      <AddressSummary address={a} />
                    </label>
                  ))}
                  <label className="address-option address-option-new">
                    <input type="radio" value={NEW_ADDRESS} {...register('addressChoice')} />
                    <span className="address-option-body">
                      <span className="address-option-title">+ Cadastrar novo endereço</span>
                      <span className="address-option-meta">
                        Ele fica salvo para os próximos pedidos.
                      </span>
                    </span>
                  </label>
                  {errors.addressChoice && (
                    <span className="field-error">{errors.addressChoice.message}</span>
                  )}
                </fieldset>
              ) : (
                <p className="field-hint">
                  Você ainda não tem endereço cadastrado. Informe onde quer receber o pedido: ele
                  será salvo como seu endereço padrão.
                </p>
              )}

              {addressChoice === NEW_ADDRESS && (
                <div className="new-address-panel" role="group" aria-labelledby="new-address-title">
                  <h3 id="new-address-title">Novo endereço</h3>
                  <AddressFields />
                  {hasAddresses && (
                    <label className="checkbox">
                      <input type="checkbox" {...register('saveAsDefault')} />
                      Usar como meu endereço padrão
                    </label>
                  )}
                </div>
              )}
            </section>
          </div>

          <CartSummary lines={lines} error={cartError} isSubmitting={mutation.isPending} />
        </div>
      </form>
    </FormProvider>
  )
}

function AddressSummary({ address }: { address: Address }) {
  return (
    <span className="address-option-body">
      <span className="address-option-title">
        {address.label ?? 'Endereço'}
        {address.isDefault && <span className="badge">Padrão</span>}
      </span>
      <span>
        {address.street}, {address.number}
        {address.complement ? ` — ${address.complement}` : ''}
      </span>
      <span className="address-option-meta">
        {address.neighborhood}, {address.city}/{address.state} · CEP{' '}
        {formatZipCode(address.zipCode)}
      </span>
    </span>
  )
}

/** Maps API field names (newAddress.street, addressId) to form paths. */
function toFormPath(field: string): Path<NewOrderForm> {
  if (field === 'addressId') return 'addressChoice'
  return field
    .replace(/^newAddress\./, 'address.')
    .replace(/\[(\d+)\]/g, '.$1') as Path<NewOrderForm>
}
