import { describe, expect, it } from 'vitest'
import { addressSchema, emptyAddress } from './addressSchema'

const valid = {
  ...emptyAddress,
  zipCode: '01310-100',
  street: 'Avenida Paulista',
  number: '1000',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
}

const errorsFor = (values: typeof valid) =>
  addressSchema.safeParse(values).error?.issues.map((issue) => issue.path[0]) ?? []

describe('addressSchema', () => {
  it('accepts fields at the API limits', () => {
    expect(
      errorsFor({
        ...valid,
        street: 'r'.repeat(150),
        number: '1'.repeat(20),
        complement: 'c'.repeat(100),
        neighborhood: 'b'.repeat(100),
        city: 'c'.repeat(100),
        label: 'l'.repeat(30),
      }),
    ).toEqual([])
  })

  it('rejects fields over the API limits before sending them', () => {
    expect(
      errorsFor({
        ...valid,
        street: 'r'.repeat(151),
        number: '1'.repeat(21),
        complement: 'c'.repeat(101),
        neighborhood: 'b'.repeat(101),
        city: 'c'.repeat(101),
        label: 'l'.repeat(31),
      }),
    ).toEqual(['street', 'number', 'complement', 'neighborhood', 'city', 'label'])
  })
})
