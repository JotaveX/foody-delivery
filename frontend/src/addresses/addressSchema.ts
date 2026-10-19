import { z } from 'zod'
import type { AddressInput } from '../auth/types'

// Same limits as the API's AddressRequest.
const optional = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`)
const required = (message: string, max: number) => optional(max).min(1, message)

export const addressSchema = z.object({
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, 'Informe um CEP com 8 dígitos.'),
  street: required('Informe a rua.', 150),
  number: required('Informe o número.', 20),
  complement: optional(100),
  neighborhood: required('Informe o bairro.', 100),
  city: required('Informe a cidade.', 100),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Use a sigla com 2 letras.'),
  label: optional(30),
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
