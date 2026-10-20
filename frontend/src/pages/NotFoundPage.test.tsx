import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/renderApp'

describe('NotFoundPage', () => {
  it('shows the unknown address and a way back, without logging in', async () => {
    renderApp('/pedidos/antigos')

    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByText('/pedidos/antigos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para o quadro' })).toHaveAttribute('href', '/')
  })
})
