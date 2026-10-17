// src/pages/PagamentoPix.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from "../lib/supabase";

// ─── Ícones inline (sem dependência extra) ───────────────────────────────────
const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={2.5}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const IconPix = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 512 512" fill="currentColor">
    <path d="M242.4 292.5C247.8 287.1 259.1 287.1 264.4 292.5L354.7 382.8C360.1 388.2 360.1 396.9 354.7 402.3L264.4 492.6C259.1 498 247.8 498 242.4 492.6L152.1 402.3C146.7 396.9 146.7 388.2 152.1 382.8L242.4 292.5zM398.3 172.3L509.5 283.6C514.9 289 514.9 297.7 509.5 303.1L398.3 414.3C392.9 419.7 384.2 419.7 378.8 414.3L267.6 303.1C262.2 297.7 262.2 289 267.6 283.6L378.8 172.3C384.2 166.9 392.9 166.9 398.3 172.3zM113.7 172.3C119.1 166.9 127.8 166.9 133.2 172.3L244.4 283.6C249.8 289 249.8 297.7 244.4 303.1L133.2 414.3C127.8 419.7 119.1 419.7 113.7 414.3L2.5 303.1C-2.9 297.7-2.9 289 2.5 283.6L113.7 172.3zM242.4 19.4C247.8 14 259.1 14 264.4 19.4L354.7 109.7C360.1 115.1 360.1 123.8 354.7 129.2L264.4 219.5C259.1 224.9 247.8 224.9 242.4 219.5L152.1 129.2C146.7 123.8 146.7 115.1 152.1 109.7L242.4 19.4z"/>
  </svg>
)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatarTempo(segundos) {
  const s = Math.max(0, segundos)
  const min = Math.floor(s / 60)
  const seg = s % 60
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}

function corDoTimer(segundos) {
  if (segundos > 600) return 'text-green-600'
  if (segundos > 120) return 'text-yellow-600'
  return 'text-red-600'
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PagamentoPix() {
  const { pedidoId } = useParams()
  const navigate = useNavigate()

  const [estado, setEstado] = useState('carregando') // carregando | pronto | expirado | erro | pago
  const [pix, setPix] = useState(null)               // { qr_code_base64, copia_e_cola, expira_em, payment_id }
  const [mensagemErro, setMensagemErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [numeroPedido, setNumeroPedido] = useState(null)

  const pollingRef = useRef(null)
  const timerRef = useRef(null)

  // ── 1. Buscar / criar PIX na Edge Function ────────────────────────────────
  const carregarPix = useCallback(async () => {
    setEstado('carregando')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-pagamento-pix`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pedido_id: pedidoId }),
        }
      )

      const data = await resp.json()

      if (!resp.ok) {
        // 409 = pedido já pago
        if (resp.status === 409) {
          navigate(`/pedido-confirmado/${pedidoId}`, { replace: true })
          return
        }
        setMensagemErro(data.error || 'Erro ao gerar PIX.')
        setEstado('erro')
        return
      }

      setPix(data)

      // Buscar número do pedido para exibição
      try {
        const { data: pedidoInfo } = await supabase.schema('public').rpc('fn_get_status_pedido', {
          p_pedido_id: pedidoId,
        })
        if (pedidoInfo?.numero) setNumeroPedido(pedidoInfo.numero)
      } catch { /* ignora */ }

      // Calcular segundos restantes até expiração
      const expira = new Date(data.expira_em)
      const restantes = Math.max(0, Math.floor((expira - Date.now()) / 1000))
      setSegundos(restantes)
      setEstado(restantes > 0 ? 'pronto' : 'expirado')

    } catch (err) {
      console.error('Erro ao conectar:', err)
      setMensagemErro('Erro de conexão. Verifique sua internet e tente novamente.')
      setEstado('erro')
    }
  }, [pedidoId, navigate])

  // ── 2. Timer regressivo ───────────────────────────────────────────────────
  useEffect(() => {
    if (estado !== 'pronto' || segundos <= 0) return

    timerRef.current = setInterval(() => {
      setSegundos(s => {
        if (s <= 1) {
          clearInterval(timerRef.current)
          setEstado('expirado')
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [estado]) // roda quando estado muda para 'pronto'

  // ── 3. Polling de status a cada 5 s ──────────────────────────────────────
  const verificarStatus = useCallback(async () => {
    try {
      const { data } = await supabase.schema('public').rpc('fn_get_status_pedido', {
        p_pedido_id: pedidoId,
      })

      if (data?.status_pagamento === 'approved') {
        clearInterval(pollingRef.current)
        clearInterval(timerRef.current)
        setEstado('pago')
        // Redireciona após 1.5 s (deixa o usuário ver a mensagem de sucesso)
        setTimeout(() => {
          navigate(`/pedido-confirmado/${pedidoId}`, { replace: true })
        }, 1500)
      }
    } catch { /* silencioso — próxima tentativa em 5 s */ }
  }, [pedidoId, navigate])

  useEffect(() => {
    if (estado !== 'pronto') return
    pollingRef.current = setInterval(verificarStatus, 5000)
    return () => clearInterval(pollingRef.current)
  }, [estado, verificarStatus])

  // ── 4. Inicialização ──────────────────────────────────────────────────────
  useEffect(() => {
    carregarPix()
    return () => {
      clearInterval(pollingRef.current)
      clearInterval(timerRef.current)
    }
  }, [carregarPix])

  // ── 5. Copiar código PIX ──────────────────────────────────────────────────
  const copiarPix = async () => {
    if (!pix?.copia_e_cola) return
    try {
      await navigator.clipboard.writeText(pix.copia_e_cola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      // Fallback para browsers sem clipboard API
      const el = document.createElement('textarea')
      el.value = pix.copia_e_cola
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    }
  }

  // ─── Render: Carregando ───────────────────────────────────────────────────
  if (estado === 'carregando') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Gerando QR Code PIX...</p>
        </div>
      </div>
    )
  }

  // ─── Render: Erro ─────────────────────────────────────────────────────────
  if (estado === 'erro') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Ops, algo deu errado</h2>
          <p className="text-gray-500 mb-6">{mensagemErro}</p>
          <button
            onClick={carregarPix}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => navigate('/cardapio')}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 py-2 transition-colors"
          >
            Voltar ao cardápio
          </button>
        </div>
      </div>
    )
  }

  // ─── Render: Pago ─────────────────────────────────────────────────────────
  if (estado === 'pago') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Pagamento confirmado!</h2>
          <p className="text-gray-500">Redirecionando para o resumo do pedido…</p>
        </div>
      </div>
    )
  }

  // ─── Render: Expirado ─────────────────────────────────────────────────────
  if (estado === 'expirado') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconClock />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">QR Code expirado</h2>
          <p className="text-gray-500 mb-6">O tempo de 30 minutos para pagamento se esgotou.</p>
          <button
            onClick={carregarPix}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Gerar novo QR Code
          </button>
          <button
            onClick={() => navigate('/cardapio')}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 py-2 transition-colors"
          >
            Voltar ao cardápio
          </button>
        </div>
      </div>
    )
  }

  // ─── Render: Pronto ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">

        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold mb-3">
            <IconPix />
            Pagamento via PIX
          </div>
          {numeroPedido && (
            <p className="text-gray-500 text-sm">
              Pedido #{String(numeroPedido).padStart(4, '0')}
            </p>
          )}
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* QR Code */}
          <div className="flex items-center justify-center p-6 bg-gray-50 border-b border-gray-100">
            {pix?.qr_code_base64 ? (
              <img
                src={`data:image/png;base64,${pix.qr_code_base64}`}
                alt="QR Code PIX Porto Grill"
                className="w-56 h-56 rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                QR Code indisponível
              </div>
            )}
          </div>

          <div className="p-6 space-y-4">

            {/* Timer */}
            <div className="flex items-center justify-center gap-2">
              <IconClock />
              <span className="text-gray-500 text-sm">Expira em</span>
              <span className={`font-mono font-bold text-lg ${corDoTimer(segundos)}`}>
                {formatarTempo(segundos)}
              </span>
            </div>

            {/* Instrução */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-gray-700 space-y-1">
              <p className="font-semibold text-green-800">Como pagar:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar com PIX QR Code</li>
                <li>Aponte a câmera para o QR Code acima</li>
                <li>Confirme o pagamento</li>
              </ol>
            </div>

            {/* Código Copia e Cola */}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                Ou copie o código PIX
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <p className="flex-1 text-xs text-gray-600 font-mono break-all line-clamp-2 leading-relaxed">
                  {pix?.copia_e_cola}
                </p>
              </div>
            </div>

            {/* Botão copiar */}
            <button
              onClick={copiarPix}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                copiado
                  ? 'bg-green-100 text-green-700 border-2 border-green-300'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg active:scale-95'
              }`}
            >
              {copiado ? (
                <>
                  <IconCheck />
                  Código copiado!
                </>
              ) : (
                <>
                  <IconCopy />
                  Copiar código PIX
                </>
              )}
            </button>

          </div>
        </div>

        {/* Aviso de polling */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-gray-400 text-xs">
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Verificando pagamento automaticamente...
          </div>
        </div>

        {/* Link de voltar */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/cardapio')}
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            ← Voltar ao cardápio
          </button>
        </div>

      </div>
    </div>
  )
}
