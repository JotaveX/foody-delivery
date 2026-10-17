import { useCallback, useEffect, useState } from 'react'
import { toApiError } from '../api/problem'
import type { Address } from '../auth/types'
import { listAddresses } from './api'

export function useAddresses() {
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setAddresses(await listAddresses())
      setError(null)
    } catch (e) {
      setError(toApiError(e).message)
    }
  }, [])

  useEffect(() => {
    let active = true
    listAddresses().then(
      (data) => {
        if (!active) return
        setAddresses(data)
        setError(null)
      },
      (e) => {
        if (active) setError(toApiError(e).message)
      },
    )
    return () => {
      active = false
    }
  }, [])

  return { addresses, error, reload }
}
