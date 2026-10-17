import { z } from 'zod'
import type { Address, AddressInput } from '../auth/types'

const required = (message: string) => z.string().trim().min(1, message)

export const addressSchema = z.object({
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
})

export type AddressFormValues = z.infer<typeof addressSchema>

export const emptyAddress: AddressFormValues = {
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  label: '',
}

/** Form values for editing an existing address. */
export function toAddressFormValues(address: Address): AddressFormValues {
  return {
    zipCode: address.zipCode.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
    street: address.street,
    number: address.number,
    complement: address.complement ?? '',
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    label: address.label ?? '',
  }
}

/** API payload: optional fields left blank are omitted. */
export function toAddressInput(values: AddressFormValues): AddressInput {
  return {
    ...values,
    state: values.state.toUpperCase(),
    label: values.label || undefined,
    complement: values.complement || undefined,
  }
}

export const onlyDigits = (value: string) => value.replace(/\D/g, '')
