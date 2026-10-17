// src/pages/PedidoConfirmado.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from "../lib/supabase";

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarNumero(n) {
  return String(n).padStart(4, '0')
}

export default function PedidoConfirmado() {
  const { pedidoId } = useParams()
  const navigate = useNavigate()

  const [pedido, setPedido] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function buscarPedido() {
      try {
        const { data } = await supabase.schema('public').rpc('fn_get_status_pedido', {
          p_pedido_id: pedidoId,
        })
        setPedido(data)
      } catch (err) {
        console.error('Erro ao buscar pedido:', err)
      } finally {
        setCarregando(false)
      }
    }
    buscarPedido()
  }, [pedidoId])

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">

        {/* Ícone de sucesso animado */}
        <div className="relative mx-auto w-24 h-24 mb-6">
          <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-30" />
          <div className="relative w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          Pedido confirmado! 🎉
        </h1>
        <p className="text-gray-500 mb-6">
          Seu pagamento foi recebido com sucesso.
        </p>

        {/* Resumo */}
        {pedido && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Número do pedido</span>
              <span className="font-bold text-gray-800">#{formatarNumero(pedido.numero)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className="text-green-600 font-semibold capitalize">
                {pedido.status || 'Em preparo'}
              </span>
            </div>
            {pedido.total && (
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-500">Total pago</span>
                <span className="font-bold text-gray-800">{formatarMoeda(pedido.total)}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-6">
          Nossa equipe já recebeu seu pedido e em breve começará a preparar com muito carinho. 🍖
        </p>

        <button
          onClick={() => navigate('/cardapio', { replace: true })}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Fazer novo pedido
        </button>

      </div>
    </div>
  )
}
