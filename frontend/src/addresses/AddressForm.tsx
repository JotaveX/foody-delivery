import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { FormProvider, useForm, type Path } from 'react-hook-form'
import { z } from 'zod'
import { toApiError } from '../api/problem'
import type { AddressInput } from '../auth/types'
import { FormAlert } from '../components/FormAlert'
import { AddressFields } from './AddressFields'
import {
  addressSchema,
  emptyAddress,
  toAddressInput,
  type AddressFormValues,
} from './addressSchema'

const formSchema = z.object({ address: addressSchema, makeDefault: z.boolean() })

type AddressFormData = z.infer<typeof formSchema>

interface AddressFormProps {
  title: string
  submitLabel: string
  initialValues?: AddressFormValues
  /** Shows the "make default" checkbox (only when creating). */
  allowMakeDefault?: boolean
  onSubmit: (address: AddressInput, makeDefault: boolean) => Promise<void>
  onCancel: () => void
}

export function AddressForm({
  title,
  submitLabel,
  initialValues = emptyAddress,
  allowMakeDefault = false,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)
  const form = useForm<AddressFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { address: initialValues, makeDefault: false },
  })
  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = form

  const submit = handleSubmit(async ({ address, makeDefault }) => {
    setApiError(null)
    try {
      await onSubmit(toAddressInput(address), makeDefault)
    } catch (error) {
      const { message, fieldErrors } = toApiError(error)
      setApiError(message)
      for (const [field, fieldMessage] of Object.entries(fieldErrors)) {
        // POST reports "address.street"; PUT takes the bare address and reports "street".
        const path = field.startsWith('address.') ? field : `address.${field}`
        setError(path as Path<AddressFormData>, { message: fieldMessage })
      }
    }
  })

  return (
    <section className="card address-form" aria-label={title}>
      <h2>{title}</h2>
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate className="form">
          <FormAlert message={apiError} />
          <AddressFields />
          {allowMakeDefault && (
            <label className="checkbox">
              <input type="checkbox" {...register('makeDefault')} />
              Usar como endereço padrão
            </label>
          )}
          <div className="form-actions">
            <button type="button" className="button-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : submitLabel}
            </button>
          </div>
        </form>
      </FormProvider>
    </section>
  )
}
