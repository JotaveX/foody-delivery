import type { Session, User } from '../auth/types'

export const user: User = {
  id: 1,
  name: 'Maria Silva',
  email: 'maria@example.com',
  createdAt: '2026-10-17T12:00:00Z',
  defaultAddress: {
    id: 1,
    label: 'Casa',
    street: 'Avenida Paulista',
    number: '1000',
    complement: null,
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01310100',
    isDefault: true,
  },
}

export function storeSession(overrides: Partial<Session> = {}) {
  const session: Session = {
    token: 'valid-token',
    expiresAt: Date.now() + 60 * 60 * 1000,
    refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    user,
    ...overrides,
  }
  localStorage.setItem('foody.session', JSON.stringify(session))
}
