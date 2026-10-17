// main.jsx — Ponto de entrada da aplicação
// Sprint 3: adicionado BrowserRouter (basename /cardapio) + rotas React Router
// Sprint 4: adicionadas rotas de pagamento PIX e confirmação de pedido

import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import Cardapio         from './pages/Cardapio'
import Login            from './pages/Login'
import Checkout         from './pages/Checkout'
import PagamentoPix     from './pages/PagamentoPix'
import PedidoConfirmado from './pages/PedidoConfirmado'
import ProtectedRoute   from './components/ProtectedRoute'
import { useAuth }      from './store/auth'

// Componente raiz que inicializa a sessão de autenticação
function App() {
  const inicializar = useAuth(s => s.inicializar)

  // Executa uma única vez: verifica sessão existente e registra listener
  useEffect(() => { inicializar() }, [inicializar])

  return (
    // basename="/cardapio" corresponde ao subpath no WordPress
    // Em dev local (npm run dev) o Vite usa base: '/cardapio/' do vite.config
    <BrowserRouter basename="/cardapio">
      <Routes>
        {/* Cardápio público — acessível sem login */}
        <Route path="/"        element={<Cardapio />} />

        {/* Login / Cadastro */}
        <Route path="/login"   element={<Login />} />

        {/* Checkout — requer login */}
        <Route path="/checkout" element={
          <ProtectedRoute>
            <Checkout />
          </ProtectedRoute>
        } />

        {/* Pagamento PIX — requer login */}
        <Route path="/pagamento/pix/:pedidoId" element={
          <ProtectedRoute>
            <PagamentoPix />
          </ProtectedRoute>
        } />

        {/* Confirmação do pedido — requer login */}
        <Route path="/pedido-confirmado/:pedidoId" element={
          <ProtectedRoute>
            <PedidoConfirmado />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
