import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Address } from '../auth/types'
import { storeSession, user as fixtureUser } from '../test/fixtures'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

const home: Address = { ...fixtureUser.defaultAddress!, id: 1, label: 'Casa' }
const work: Address = {
  id: 2,
  label: 'Trabalho',
  street: 'Rua Augusta',
  number: '500',
  complement: 'Sala 12',
  neighborhood: 'Consolação',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01305000',
  isDefault: false,
}

/** In-memory stand-in for the address API, so reloads reflect every mutation. */
function mockAddressApi(initial: Address[]) {
  let addresses = initial.map((a) => ({ ...a }))
  let nextId = 100
  const requests: { method: string; path: string; body?: unknown }[] = []
  const sorted = () => [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  const defaultAddress = () => addresses.find((a) => a.isDefault) ?? null

  server.use(
    http.get('/api/auth/me', () =>
      HttpResponse.json({ ...fixtureUser, defaultAddress: defaultAddress() }),
    ),
    http.get('/api/addresses', () => HttpResponse.json(sorted())),
    http.post('/api/addresses', async ({ request }) => {
      const body = (await request.json()) as { address: Address; makeDefault: boolean }
      requests.push({ method: 'POST', path: '/addresses', body })
      if (body.makeDefault) addresses.forEach((a) => (a.isDefault = false))
      const created = {
        ...body.address,
        id: nextId++,
        label: body.address.label ?? null,
        complement: body.address.complement ?? null,
        zipCode: body.address.zipCode.replace('-', ''),
        isDefault: body.makeDefault,
      }
      addresses.push(created)
      return HttpResponse.json(created, { status: 201 })
    }),
    http.put('/api/addresses/:id', async ({ request, params }) => {
      const body = (await request.json()) as Address
      requests.push({ method: 'PUT', path: `/addresses/${params.id}`, body })
      const old = addresses.find((a) => a.id === Number(params.id))!
      const created = {
        ...old,
        ...body,
        id: nextId++,
        zipCode: body.zipCode.replace('-', ''),
      }
      addresses = addresses.filter((a) => a !== old).concat(created)
      return HttpResponse.json(created)
    }),
    http.patch('/api/addresses/:id/default', ({ params }) => {
      requests.push({ method: 'PATCH', path: `/addresses/${params.id}/default` })
      addresses.forEach((a) => (a.isDefault = a.id === Number(params.id)))
      return HttpResponse.json(addresses.find((a) => a.id === Number(params.id)))
    }),
    http.delete('/api/addresses/:id', ({ params }) => {
      requests.push({ method: 'DELETE', path: `/addresses/${params.id}` })
      addresses = addresses.filter((a) => a.id !== Number(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { requests }
}

const card = (name: string) => screen.getByRole('listitem', { name })

describe('AddressesPage', () => {
  beforeEach(() => storeSession())

  it('lists the addresses with the default first and blocks deleting it', async () => {
    mockAddressApi([work, home])
    renderApp('/addresses')

    const items = await screen.findAllByRole('listitem')
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['Casa', 'Trabalho'])
    expect(within(card('Casa')).getByText('Padrão')).toBeInTheDocument()
    expect(within(card('Casa')).getByRole('button', { name: 'Excluir' })).toBeDisabled()
    expect(
      within(card('Casa')).queryByRole('button', { name: 'Definir como padrão' }),
    ).not.toBeInTheDocument()
    expect(within(card('Trabalho')).getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  it('creates an address using the CEP autofill', async () => {
    const api = mockAddressApi([home])
    server.use(
      http.get('https://viacep.com.br/ws/:cep/json/', () =>
        HttpResponse.json({
          logradouro: 'Rua Oscar Freire',
          bairro: 'Jardins',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      ),
    )
    const { user } = renderApp('/addresses')

    await user.click(await screen.findByRole('button', { name: 'Novo endereço' }))
    const form = screen.getByRole('region', { name: 'Novo endereço' })
    await user.type(within(form).getByLabelText('CEP'), '01426001')
    await waitFor(() => expect(within(form).getByLabelText('Rua')).toHaveValue('Rua Oscar Freire'))
    await user.type(within(form).getByLabelText('Número'), '42')
    await user.type(within(form).getByLabelText('Apelido do endereço (opcional)'), 'Academia')
    await user.click(within(form).getByLabelText('Usar como endereço padrão'))
    await user.click(within(form).getByRole('button', { name: 'Adicionar endereço' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Endereço adicionado.')
    expect(api.requests).toEqual([
      {
        method: 'POST',
        path: '/addresses',
        body: {
          makeDefault: true,
          address: {
            zipCode: '01426001',
            street: 'Rua Oscar Freire',
            number: '42',
            neighborhood: 'Jardins',
            city: 'São Paulo',
            state: 'SP',
            label: 'Academia',
          },
        },
      },
    ])
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveAccessibleName('Academia')
    expect(within(items[0]).getByText('Padrão')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Novo endereço' })).not.toBeInTheDocument()
  })

  it('edits an address prefilled with its current values', async () => {
    const api = mockAddressApi([home, work])
    const { user } = renderApp('/addresses')

    await user.click(
      within(await screen.findByRole('listitem', { name: 'Trabalho' })).getByRole('button', {
        name: 'Editar',
      }),
    )
    const form = screen.getByRole('region', { name: 'Editar endereço' })
    expect(within(form).getByLabelText('CEP')).toHaveValue('01305-000')
    expect(within(form).getByLabelText('Rua')).toHaveValue('Rua Augusta')
    expect(within(form).getByLabelText('Complemento (opcional)')).toHaveValue('Sala 12')
    expect(within(form).queryByLabelText('Usar como endereço padrão')).not.toBeInTheDocument()

    const number = within(form).getByLabelText('Número')
    await user.clear(number)
    await user.type(number, '600')
    await user.click(within(form).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Endereço atualizado.')
    expect(api.requests).toEqual([
      {
        method: 'PUT',
        path: '/addresses/2',
        body: expect.objectContaining({
          street: 'Rua Augusta',
          number: '600',
          zipCode: '01305-000',
        }),
      },
    ])
    expect(within(card('Trabalho')).getByText('Rua Augusta, 600 — Sala 12')).toBeInTheDocument()
  })

  it('makes another address the default', async () => {
    const api = mockAddressApi([home, work])
    const { user } = renderApp('/addresses')

    await user.click(
      within(await screen.findByRole('listitem', { name: 'Trabalho' })).getByRole('button', {
        name: 'Definir como padrão',
      }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent('Endereço padrão atualizado.')
    expect(api.requests).toEqual([{ method: 'PATCH', path: '/addresses/2/default' }])
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveAccessibleName('Trabalho')
    expect(within(items[0]).getByText('Padrão')).toBeInTheDocument()
    expect(within(card('Casa')).queryByText('Padrão')).not.toBeInTheDocument()
  })

  it('asks for confirmation before deleting', async () => {
    const api = mockAddressApi([home, work])
    const { user } = renderApp('/addresses')

    const deleteButton = within(
      await screen.findByRole('listitem', { name: 'Trabalho' }),
    ).getByRole('button', { name: 'Excluir' })
    await user.click(deleteButton)
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Excluir endereço?' })).getByRole('button', {
        name: 'Cancelar',
      }),
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(api.requests).toEqual([])

    await user.click(deleteButton)
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent('Endereço excluído.')
    expect(api.requests).toEqual([{ method: 'DELETE', path: '/addresses/2' }])
    expect(screen.queryByRole('listitem', { name: 'Trabalho' })).not.toBeInTheDocument()
  })

  it('shows the ProblemDetail message when the API refuses the delete', async () => {
    mockAddressApi([home, work])
    server.use(
      http.delete('/api/addresses/:id', () =>
        HttpResponse.json(
          {
            status: 409,
            detail:
              'Não é possível excluir o endereço padrão. Defina outro endereço como padrão antes.',
          },
          { status: 409 },
        ),
      ),
    )
    const { user } = renderApp('/addresses')

    await user.click(
      within(await screen.findByRole('listitem', { name: 'Trabalho' })).getByRole('button', {
        name: 'Excluir',
      }),
    )
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não é possível excluir o endereço padrão.',
    )
    expect(screen.getByRole('listitem', { name: 'Trabalho' })).toBeInTheDocument()
  })
})
