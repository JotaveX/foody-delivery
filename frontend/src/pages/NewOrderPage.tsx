import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FormProvider, useForm, useWatch, type Path, type Resolver } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import {
  AddressFields,
  addressSchema,
  emptyAddress,
  toAddressInput,
  useAddresses,
  useSaveAddress,
  type AddressFormValues,
} from '@/features/address'
import { useAuth } from '@/features/auth'
import { useProducts } from '@/features/catalog'
import {
  CartSummary,
  cartLines,
  ProductPicker,
  setQuantity,
  useCreateOrder,
  type Cart,
  type CreateOrderInput,
} from '@/features/order'
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog'
import { Field } from '@/shared/components/ui/Field'
import { FormAlert } from '@/shared/components/ui/FormAlert'
import { QueryState } from '@/shared/components/ui/QueryState'
import { toApiError } from '@/shared/lib/api/problem'
import type { Address } from '@/shared/types/user'
import { formatZipCode } from '@/shared/utils/format'

/** Choice value meaning "register a new address" instead of using a saved one. */
const NEW_ADDRESS = 'new'

/** `?etapa=entrega` is the delivery step: the browser's back button returns to the menu. */
const STEP_PARAM = 'etapa'
const DELIVERY_STEP = 'entrega'

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
    <section className="new-order">
      <Link to="/orders" className="back-link">
        ← Voltar ao quadro
      </Link>
      <h1 className="page-title">Novo pedido</h1>
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
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [apiError, setApiError] = useState<string | null>(null)
  const [saveAddressError, setSaveAddressError] = useState<string | null>(null)
  // An order with a typed (unsaved) address waiting for the user to confirm it.
  const [unsavedAddressOrder, setUnsavedAddressOrder] = useState<CreateOrderInput | null>(null)
  // Stable: the dialog re-subscribes its Escape listener (and refocuses) when it changes.
  const reviewAddress = useCallback(() => setUnsavedAddressOrder(null), [])
  // The cart lives outside react-hook-form: it is driven by the catalog and the ticket, not inputs.
  const [cart, setCart] = useState<Cart>(() => new Map())
  const [cartError, setCartError] = useState<string | null>(null)
  const products = useProducts()
  const lines = cartLines(cart, products.data ?? [])
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0]

  const wantsDelivery = searchParams.get(STEP_PARAM) === DELIVERY_STEP
  // The delivery step needs items: opened directly (or emptied there), it falls back to the menu.
  const step = wantsDelivery && cart.size > 0 ? 'delivery' : 'menu'

  useEffect(() => {
    if (wantsDelivery && cart.size === 0) setSearchParams({}, { replace: true })
  }, [wantsDelivery, cart.size, setSearchParams])

  // Moving between steps puts focus (and the scroll) on the new step's heading.
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const shownStep = useRef(step)
  useEffect(() => {
    if (shownStep.current === step) return
    shownStep.current = step
    stepHeading.current?.focus()
  }, [step])

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
    setValue,
    getValues,
    trigger,
    clearErrors,
    formState: { errors },
  } = form
  const addressChoice = useWatch({ control, name: 'addressChoice' })
  const hasAddresses = addresses.length > 0

  const addOne = (productId: number) => changeQuantity(productId, (cart.get(productId) ?? 0) + 1)
  const changeQuantity = (productId: number, quantity: number) => {
    setCart((current) => setQuantity(current, productId, quantity))
    setCartError(null)
  }

  const goToDelivery = () =>
    setSearchParams({ [STEP_PARAM]: DELIVERY_STEP }, { state: { fromMenu: true } })
  const backToMenu = () => {
    // Pops the entry pushed by "Continuar" so back/forward keep making sense.
    if ((location.state as { fromMenu?: boolean } | null)?.fromMenu) navigate(-1)
    else setSearchParams({}, { replace: true })
  }

  const saveAddressMutation = useSaveAddress()

  const saveNewAddress = async () => {
    setSaveAddressError(null)
    if (!(await trigger('address'))) return
    try {
      const created = await saveAddressMutation.mutateAsync({
        values: getValues('address'),
        makeDefault: getValues('saveAsDefault'),
      })
      setValue('addressChoice', String(created.id))
      setValue('address', emptyAddress)
      setValue('saveAsDefault', false)
      clearErrors('address')
      if (created.isDefault) void refreshUser().catch(() => {})
    } catch (error) {
      const { message, fieldErrors } = toApiError(error)
      setSaveAddressError(message)
      for (const [field, fieldMessage] of Object.entries(fieldErrors)) {
        if (field.startsWith('address.')) setError(toFormPath(field), { message: fieldMessage })
      }
    }
  }

  const mutation = useCreateOrder({ onAddressCreated: () => refreshUser().catch(() => {}) })

  const placeOrder = async (input: CreateOrderInput) => {
    setApiError(null)
    try {
      await mutation.mutateAsync(input)
      navigate('/orders')
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
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    // Unreachable through the UI (there is no submit button on the menu step, and it is disabled
    // without items, which also blocks submitting with Enter), but an order without items must
    // never be sent.
    if (step !== 'delivery' || lines.length === 0) return
    const base = {
      customerName: values.customerName,
      // Never the price: the server copies it from the catalog.
      items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
    }
    if (values.addressChoice === NEW_ADDRESS) {
      // The typed address was not saved: warn that the order will save it and deliver there.
      setUnsavedAddressOrder({
        ...base,
        newAddress: toAddressInput(values.address),
        saveAsDefault: values.saveAsDefault,
      })
      return
    }
    await placeOrder({ ...base, addressId: Number(values.addressChoice) })
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="form order-form">
        <ol className="order-steps" aria-label="Etapas do pedido">
          <li aria-current={step === 'menu' ? 'step' : undefined}>
            <span className="order-step-number">01</span> Cardápio
          </li>
          <li aria-current={step === 'delivery' ? 'step' : undefined}>
            <span className="order-step-number">02</span> Entrega
          </li>
        </ol>

        <FormAlert message={apiError} />

        <div className="order-layout">
          <div className="order-main">
            {step === 'menu' ? (
              <section className="panel" aria-labelledby="order-menu-title">
                <div className="section-head">
                  <h2 id="order-menu-title" ref={stepHeading} tabIndex={-1}>
                    Cardápio
                  </h2>
                  {products.data && <span className="count">{products.data.length} itens</span>}
                </div>
                <QueryState
                  isPending={products.isPending}
                  error={products.error}
                  loadingText="Carregando o cardápio…"
                  onRetry={() => products.refetch()}
                >
                  {products.data && (
                    <ProductPicker products={products.data} cart={cart} onAdd={addOne} />
                  )}
                </QueryState>
              </section>
            ) : (
              <section className="panel" aria-labelledby="order-address-title">
                <div className="section-head">
                  <h2 id="order-address-title" ref={stepHeading} tabIndex={-1}>
                    Entrega
                  </h2>
                  <button type="button" className="step-back" onClick={backToMenu}>
                    ← Voltar ao cardápio
                  </button>
                </div>

                <Field
                  label="Cliente"
                  autoComplete="off"
                  registration={register('customerName')}
                  error={errors.customerName}
                  className="customer-field"
                />

                {hasAddresses ? (
                  <fieldset className="address-options">
                    <legend className="label">Endereço de entrega</legend>
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
                  <div
                    className="new-address-panel"
                    role="group"
                    aria-labelledby="new-address-title"
                  >
                    <h3 id="new-address-title">Novo endereço</h3>
                    <AddressFields />
                    {hasAddresses && (
                      <label className="checkbox">
                        <input type="checkbox" {...register('saveAsDefault')} />
                        Usar como meu endereço padrão
                      </label>
                    )}
                    <FormAlert message={saveAddressError} />
                    <button
                      type="button"
                      className="btn btn-outline new-address-save"
                      disabled={saveAddressMutation.isPending}
                      aria-busy={saveAddressMutation.isPending}
                      onClick={saveNewAddress}
                    >
                      {saveAddressMutation.isPending ? 'Salvando…' : 'Salvar endereço'}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
          <CartSummary
            lines={lines}
            error={cartError}
            step={step}
            isSubmitting={mutation.isPending}
            onQuantityChange={changeQuantity}
            onContinue={goToDelivery}
          />
        </div>
      </form>

      {unsavedAddressOrder && (
        <ConfirmDialog
          title="Endereço não salvo"
          confirmLabel="Salvar e criar pedido"
          cancelLabel="Revisar endereço"
          onCancel={reviewAddress}
          onConfirm={() => {
            const input = unsavedAddressOrder
            setUnsavedAddressOrder(null)
            void placeOrder(input)
          }}
        >
          <p>
            Você não salvou o novo endereço. Vamos salvá-lo junto com o pedido, e a entrega será
            nele.
          </p>
        </ConfirmDialog>
      )}
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
