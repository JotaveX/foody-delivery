import { BrowserRouter } from 'react-router'
import { AppRoutes } from './AppRoutes'
import { AuthProvider } from './auth/AuthProvider'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
