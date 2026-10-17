import { useEffect, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Field } from '../components/Field'
import { lookupCep } from '../lib/viacep'
import { onlyDigits, type AddressFormValues } from './addressSchema'

/** Any form that nests an address under the `address` key can render these fields. */
interface WithAddress {
  address: AddressFormValues
}

/**
 * Address inputs with ZIP code autofill via ViaCEP. The lookup only runs when the user types a CEP
 * different from the one the form started with, so editing an address never overwrites it.
 */
export function AddressFields() {
  const {
    register,
    setValue,
    setFocus,
    getValues,
    control,
    formState: { errors },
  } = useFormContext<WithAddress>()
  const [initialZip] = useState(() => onlyDigits(getValues('address.zipCode')))
  // Last finished CEP lookup; the status shown for the current CEP is derived from it.
  const [cepLookup, setCepLookup] = useState<{ cep: string; found: boolean } | null>(null)

  const zipDigits = onlyDigits(useWatch({ control, name: 'address.zipCode' }))
  const shouldLookup = zipDigits.length === 8 && zipDigits !== initialZip
  const cepStatus = !shouldLookup
    ? 'idle'
    : cepLookup?.cep !== zipDigits
      ? 'loading'
      : cepLookup.found
        ? 'idle'
        : 'not-found'

  useEffect(() => {
    if (!shouldLookup) return
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
  }, [shouldLookup, zipDigits, setValue, setFocus])

  const cepHint =
    cepStatus === 'loading'
      ? 'Buscando endereço…'
      : cepStatus === 'not-found'
        ? 'CEP não encontrado. Preencha o endereço manualmente.'
        : 'O endereço é preenchido automaticamente.'
  const fieldErrors = errors.address

  return (
    <>
      <Field
        label="CEP"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={9}
        registration={register('address.zipCode')}
        error={fieldErrors?.zipCode}
        hint={cepHint}
        className="field-narrow"
      />
      <div className="field-row field-row-wide">
        <Field
          label="Rua"
          autoComplete="address-line1"
          registration={register('address.street')}
          error={fieldErrors?.street}
        />
        <Field
          label="Número"
          registration={register('address.number')}
          error={fieldErrors?.number}
        />
      </div>
      <Field
        label="Complemento (opcional)"
        autoComplete="address-line2"
        registration={register('address.complement')}
        error={fieldErrors?.complement}
      />
      <Field
        label="Bairro"
        registration={register('address.neighborhood')}
        error={fieldErrors?.neighborhood}
      />
      <div className="field-row field-row-wide">
        <Field
          label="Cidade"
          autoComplete="address-level2"
          registration={register('address.city')}
          error={fieldErrors?.city}
        />
        <Field
          label="UF"
          autoComplete="address-level1"
          maxLength={2}
          registration={register('address.state')}
          error={fieldErrors?.state}
        />
      </div>
      <Field
        label="Apelido do endereço (opcional)"
        placeholder="Casa, Trabalho…"
        registration={register('address.label')}
        error={fieldErrors?.label}
      />
    </>
  )
}
