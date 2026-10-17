// ProtectedRoute.jsx
// Guarda rotas autenticadas. Se não houver sessão ativa, redireciona
// para /login preservando a rota de destino no state (para voltar após login).

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function ProtectedRoute({ children }) {
  const { session, carregando } = useAuth()
  const location = useLocation()

  // Aguarda a verificação inicial de sessão para não redirecionar prematuramente
  if (carregando) {
    return (
      <div className="min-h-screen bg-carbon-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-brasa-600 border-t-transparent
                        rounded-full animate-spin" />
      </div>
    )
  }

  // Sem sessão → redireciona para login, guarda a rota atual para voltar depois
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
