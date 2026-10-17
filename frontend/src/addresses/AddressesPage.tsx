import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { toApiError } from '../api/problem'
import type { Address, AddressInput } from '../auth/types'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FormAlert } from '../components/FormAlert'
import { AddressForm } from './AddressForm'
import { toAddressFormValues } from './addressSchema'
import { createAddress, deleteAddress, makeDefaultAddress, updateAddress } from './api'
import { addressKeys, useAddresses } from './useAddresses'

type Editor = { mode: 'create' } | { mode: 'edit'; address: Address } | null

export function AddressesPage() {
  const { data: addresses, error, isPending } = useAddresses()
  const queryClient = useQueryClient()
  const loadError = error ? toApiError(error).message : null
  const { refreshUser } = useAuth()
  const [editor, setEditor] = useState<Editor>(null)
  const [toDelete, setToDelete] = useState<Address | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const done = async (message: string, defaultChanged: boolean) => {
    setNotice(message)
    await queryClient.invalidateQueries({ queryKey: addressKeys.all })
    // The header/home show the default address, kept in the auth session.
    if (defaultChanged) await refreshUser().catch(() => {})
  }

  const startAction = () => {
    setActionError(null)
    setNotice(null)
  }

  const handleCreate = async (address: AddressInput, makeDefault: boolean) => {
    await createAddress(address, makeDefault)
    setEditor(null)
    await done('Endereço adicionado.', makeDefault)
  }

  const handleUpdate = (original: Address) => async (address: AddressInput) => {
    await updateAddress(original.id, address)
    setEditor(null)
    await done('Endereço atualizado.', original.isDefault)
  }

  const handleMakeDefault = async (address: Address) => {
    startAction()
    setBusyId(address.id)
    try {
      await makeDefaultAddress(address.id)
      await done('Endereço padrão atualizado.', true)
    } catch (error) {
      setActionError(toApiError(error).message)
    } finally {
      setBusyId(null)
    }
  }

  const cancelDelete = useCallback(() => setToDelete(null), [])

  const confirmDelete = async () => {
    if (!toDelete) return
    startAction()
    setDeleting(true)
    try {
      await deleteAddress(toDelete.id)
      await done('Endereço excluído.', false)
    } catch (error) {
      setActionError(toApiError(error).message)
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  const onlyOne = addresses?.length === 1

  return (
    <section className="addresses">
      <div className="page-header">
        <div>
          <h1>Meus endereços</h1>
          <p className="muted">Onde você recebe seus pedidos.</p>
        </div>
        {!editor && (
          <button
            type="button"
            className="button-primary"
            onClick={() => {
              startAction()
              setEditor({ mode: 'create' })
            }}
          >
            Novo endereço
          </button>
        )}
      </div>

      <FormAlert message={actionError ?? loadError} />
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}

      {editor?.mode === 'create' && (
        <AddressForm
          title="Novo endereço"
          submitLabel="Adicionar endereço"
          allowMakeDefault
          onSubmit={handleCreate}
          onCancel={() => setEditor(null)}
        />
      )}
      {editor?.mode === 'edit' && (
        <AddressForm
          key={editor.address.id}
          title="Editar endereço"
          submitLabel="Salvar alterações"
          initialValues={toAddressFormValues(editor.address)}
          onSubmit={handleUpdate(editor.address)}
          onCancel={() => setEditor(null)}
        />
      )}

      {isPending && (
        <p className="muted" role="status" aria-busy="true">
          Carregando endereços…
        </p>
      )}
      {addresses?.length === 0 && <p className="muted">Nenhum endereço cadastrado.</p>}

      <ul className="address-list">
        {addresses?.map((address) => {
          const name = address.label ?? 'Endereço'
          const deleteBlocker = onlyOne
            ? 'Você precisa ter ao menos um endereço.'
            : address.isDefault
              ? 'Defina outro endereço como padrão antes de excluir este.'
              : undefined
          return (
            <li key={address.id} className="card address-card" aria-label={name}>
              <div className="address-card-body">
                <p className="address-card-title">
                  {name}
                  {address.isDefault && <span className="badge">Padrão</span>}
                </p>
                <p>
                  {address.street}, {address.number}
                  {address.complement ? ` — ${address.complement}` : ''}
                </p>
                <p className="muted">
                  {address.neighborhood}, {address.city}/{address.state} · CEP{' '}
                  {address.zipCode.replace(/^(\d{5})(\d{3})$/, '$1-$2')}
                </p>
              </div>
              <div className="address-card-actions">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    startAction()
                    setEditor({ mode: 'edit', address })
                  }}
                >
                  Editar
                </button>
                {!address.isDefault && (
                  <button
                    type="button"
                    className="button-ghost"
                    disabled={busyId === address.id}
                    onClick={() => handleMakeDefault(address)}
                  >
                    Definir como padrão
                  </button>
                )}
                <button
                  type="button"
                  className="button-ghost button-ghost-danger"
                  disabled={deleteBlocker !== undefined}
                  title={deleteBlocker}
                  onClick={() => {
                    startAction()
                    setToDelete(address)
                  }}
                >
                  Excluir
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {toDelete && (
        <ConfirmDialog
          title="Excluir endereço?"
          confirmLabel="Excluir"
          busyLabel="Excluindo…"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        >
          <p>
            {toDelete.label ?? 'Endereço'}: {toDelete.street}, {toDelete.number}. Pedidos já feitos
            para este endereço não são afetados.
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}
