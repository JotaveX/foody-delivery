import type { ReactNode } from 'react'

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="brand">Foody</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}
