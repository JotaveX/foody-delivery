const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export const formatBRL = (value: number) => brl.format(value)

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))

export const formatZipCode = (zipCode: string) => zipCode.replace(/^(\d{5})(\d{3})$/, '$1-$2')

interface AddressLike {
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
}

/** "Rua X, 10 · Bairro, Cidade/UF" */
export const formatAddressSummary = (a: AddressLike) =>
  `${a.street}, ${a.number} · ${a.neighborhood}, ${a.city}/${a.state}`

const amount = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "24,90": money on ticket lines, where the currency is implied. */
export const formatAmount = (value: number) => amount.format(value)
