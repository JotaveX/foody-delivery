export interface CepAddress {
  street: string
  neighborhood: string
  city: string
  state: string
}

interface ViaCepResponse {
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

/**
 * Looks up a Brazilian ZIP code on ViaCEP, straight from the browser. Returns null on any failure
 * (unknown CEP, network error, timeout): autofill is a convenience and must never block the form.
 */
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const timeout = AbortSignal.timeout(5000)
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    })
    if (!response.ok) return null
    const data = (await response.json()) as ViaCepResponse
    if (data.erro) return null
    return {
      street: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return null
  }
}
