// Checkout.jsx — Página de finalização do pedido
// Fluxo:
//   1. Formulário de endereço com busca automática de CEP (ViaCEP)
//   2. Cálculo de frete por distância (Haversine + Nominatim)
//   3. Resumo dos itens do carrinho
//   4. Confirmação → chama fn_criar_pedido_completo (SECURITY DEFINER)
//   5. Redireciona para /pagamento/pix/:pedidoId

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/auth'
import { useCarrinho, useCarrinhoTotal } from '../store/carrinho'
import { buscarCep, calcularFreteEndereco } from '../lib/frete'

function formatPreco(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarCep(valor) {
  const s = valor.replace(/\D/g, '').slice(0, 8)
  return s.length > 5 ? `${s.slice(0, 5)}-${s.slice(5)}` : s
}

// Estado inicial do formulário de endereço
const ENDERECO_VAZIO = {
  cep:         '',
  logradouro:  '',
  numero:      '',
  complemento: '',
  bairro:      '',
  cidade:      '',
  uf:          '',
}

export default function Checkout() {
  const navigate  = useNavigate()
  const { usuario, logout } = useAuth()
  const { itens, limparCarrinho } = useCarrinho()
  const subtotal  = useCarrinhoTotal()

  // ---- Estado do endereço ----
  const [end,        setEnd]        = useState(ENDERECO_VAZIO)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [erroCep,    setErroCep]    = useState('')

  // ---- Estado do frete ----
  const [freteInfo,      setFreteInfo]      = useState(null)
  const [calculandoFrete, setCalculandoFrete] = useState(false)
  const [erroFrete,      setErroFrete]      = useState('')

  // ---- Estado do pedido ----
  const [enviando,   setEnviando]   = useState(false)
  const [erroPedido, setErroPedido] = useState('')

  // ---- Helpers ----
  const nomeUsuario = usuario?.user_metadata?.nome_completo || usuario?.email || ''
  const totalFinal  = freteInfo?.entrega ? subtotal + freteInfo.preco : subtotal

  // ----------------------------------------------------------------
  // 1. Busca CEP
  // ----------------------------------------------------------------
  async function handleBuscarCep() {
    const cepLimpo = end.cep.replace(/\D/g, '')
    if (cepLimpo.length !== 8) {
      setErroCep('Digite um CEP com 8 dígitos.')
      return
    }
    setBuscandoCep(true)
    setErroCep('')
    setFreteInfo(null)
    try {
      const dados = await buscarCep(cepLimpo)
      setEnd(prev => ({
        ...prev,
        logradouro: dados.logradouro,
        bairro:     dados.bairro,
        cidade:     dados.cidade,
        uf:         dados.uf,
      }))
    } catch (err) {
      setErroCep(err.message)
    } finally {
      setBuscandoCep(false)
    }
  }

  // ----------------------------------------------------------------
  // 2. Calcula frete
  // ----------------------------------------------------------------
  async function handleCalcularFrete() {
    if (!end.logradouro || !end.numero || !end.bairro || !end.cidade) {
      setErroFrete('Preencha o endereço completo antes de calcular.')
      return
    }
    setCalculandoFrete(true)
    setErroFrete('')
    setFreteInfo(null)
    const resultado = await calcularFreteEndereco(
      end.logradouro, end.numero, end.bairro, end.cidade, end.uf
    )
    if (resultado.ok) {
      setFreteInfo(resultado)
    } else {
      setErroFrete(resultado.erro)
    }
    setCalculandoFrete(false)
  }

  // ----------------------------------------------------------------
  // 3. Confirma pedido — chama fn_criar_pedido_completo via RPC
  //    (SECURITY DEFINER — acessa loja.pedidos sem expor o schema)
  // ----------------------------------------------------------------
  async function handleConfirmar() {
    if (!freteInfo?.entrega) {
      setErroPedido('Calcule o frete antes de confirmar.')
      return
    }
    if (itens.length === 0) {
      setErroPedido('Seu carrinho está vazio.')
      return
    }

    setEnviando(true)
    setErroPedido('')

    try {
      // Monta payload do pedido
      const pedidoPayload = {
        cliente_vip_id:  null, // loja users não estão em public.clientes — vinculação VIPcard futura
        nome_cliente:    nomeUsuario,
        telefone:        usuario.user_metadata?.telefone || '',
        tipo:            'delivery',
        status:          'aguardando',
        cep:             end.cep.replace(/\D/g, ''),
        logradouro:      end.logradouro,
        numero_endereco: end.numero,
        complemento:     end.complemento || '',
        bairro:          end.bairro,
        cidade:          end.cidade,
        lat:             freteInfo.lat,
        lng:             freteInfo.lng,
        distancia_km:    parseFloat(freteInfo.distancia_km.toFixed(2)),
        faixa_frete:     freteInfo.label,
        subtotal,
        taxa_entrega:    freteInfo.preco,
        desconto_vip:    0,
        total:           totalFinal,
        forma_pagamento: 'pix',
        status_pagamento: 'pending',
      }

      // Monta payload dos itens (com complementos aninhados)
      const itensPayload = itens.map(item => {
        const totalComplementos = item.complementos.reduce(
          (s, c) => s + (c.preco_adicional || 0), 0
        )
        return {
          produto_id:         item.produto.id,
          nome_produto:       item.produto.nome,
          preco_unitario:     item.produto.preco,
          quantidade:         item.quantidade,
          total_complementos: totalComplementos,
          complementos: item.complementos.map(c => ({
            grupo_nome:      c.grupo_nome || '',
            item_nome:       c.nome,
            preco_adicional: c.preco_adicional || 0,
          })),
        }
      })

      // Chamada única ao banco — atômica, SECURITY DEFINER em public schema
      // Usa .schema('public') porque o client padrão aponta para loja
      const { data, error } = await supabase.schema('public').rpc('fn_criar_pedido_completo', {
        p_pedido: pedidoPayload,
        p_itens:  itensPayload,
      })

      if (error) throw new Error(error.message)

      const pedidoId = data.id

      // Limpa carrinho e vai para a tela de pagamento PIX
      limparCarrinho()
      navigate(`/pagamento/pix/${pedidoId}`)

    } catch (err) {
      setErroPedido('Erro ao registrar pedido: ' + (err.message || 'tente novamente.'))
    } finally {
      setEnviando(false)
    }
  }

  // ----------------------------------------------------------------
  // TELA PRINCIPAL DO CHECKOUT
  // ----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-carbon-900">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-carbon-950/95 backdrop-blur
                         border-b border-carbon-800 px-4 py-3
                         flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-carbon-400 hover:text-carbon-100
                     transition-colors text-sm"
        >
          ← Voltar
        </button>
        <h1 className="font-bold text-carbon-50 text-sm">Finalizar pedido</h1>
        <button
          onClick={logout}
          className="text-xs text-carbon-500 hover:text-carbon-300 transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Saudação */}
        <div className="bg-carbon-800 rounded-2xl px-5 py-4">
          <p className="text-sm text-carbon-400">
            Olá, <span className="text-carbon-50 font-semibold">{nomeUsuario}</span>
          </p>
        </div>

        {/* ========= SEÇÃO: ENDEREÇO ========= */}
        <section className="bg-carbon-800 rounded-2xl px-5 py-5 space-y-4">
          <h2 className="font-bold text-carbon-50">📍 Endereço de entrega</h2>

          {/* CEP */}
          <div>
            <label className="block text-xs text-carbon-400 mb-1.5">CEP</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="00000-000"
                maxLength={9}
                value={end.cep}
                onChange={e => {
                  setEnd(prev => ({ ...prev, cep: formatarCep(e.target.value) }))
                  setFreteInfo(null)
                  setErroCep('')
                }}
                onKeyDown={e => e.key === 'Enter' && handleBuscarCep()}
                className="flex-1 bg-carbon-900 border border-carbon-700 rounded-xl
                           px-4 py-3 text-carbon-50 placeholder-carbon-500 text-sm
                           focus:outline-none focus:border-brasa-600 transition-colors"
              />
              <button
                onClick={handleBuscarCep}
                disabled={buscandoCep}
                className="px-4 py-3 bg-carbon-700 hover:bg-carbon-600
                           text-carbon-100 text-sm font-medium rounded-xl
                           transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {buscandoCep ? '…' : 'Buscar'}
              </button>
            </div>
            {erroCep && <p className="text-xs text-red-400 mt-1.5">{erroCep}</p>}
          </div>

          {/* Logradouro */}
          <div>
            <label className="block text-xs text-carbon-400 mb-1.5">Rua / Avenida</label>
            <input
              type="text"
              placeholder="Nome da rua"
              value={end.logradouro}
              onChange={e => { setEnd(p => ({ ...p, logradouro: e.target.value })); setFreteInfo(null) }}
              className="w-full bg-carbon-900 border border-carbon-700 rounded-xl
                         px-4 py-3 text-carbon-50 placeholder-carbon-500 text-sm
                         focus:outline-none focus:border-brasa-600 transition-colors"
            />
          </div>

          {/* Número + Complemento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-carbon-400 mb-1.5">Número</label>
              <input
                type="text"
                placeholder="123"
                value={end.numero}
                onChange={e => { setEnd(p => ({ ...p, numero: e.target.value })); setFreteInfo(null) }}
                className="w-full bg-carbon-900 border border-carbon-700 rounded-xl
                           px-4 py-3 text-carbon-50 placeholder-carbon-500 text-sm
                           focus:outline-none focus:border-brasa-600 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-carbon-400 mb-1.5">
                Complemento
                <span className="text-carbon-600 ml-1">(opc.)</span>
              </label>
              <input
                type="text"
                placeholder="Ap. 201"
                value={end.complemento}
                onChange={e => setEnd(p => ({ ...p, complemento: e.target.value }))}
                className="w-full bg-carbon-900 border border-carbon-700 rounded-xl
                           px-4 py-3 text-carbon-50 placeholder-carbon-500 text-sm
                           focus:outline-none focus:border-brasa-600 transition-colors"
              />
            </div>
          </div>

          {/* Bairro + Cidade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-carbon-400 mb-1.5">Bairro</label>
              <input
                type="text"
                placeholder="Bairro"
                value={end.bairro}
                onChange={e => { setEnd(p => ({ ...p, bairro: e.target.value })); setFreteInfo(null) }}
                className="w-full bg-carbon-900 border border-carbon-700 rounded-xl
                           px-4 py-3 text-carbon-50 placeholder-carbon-500 text-sm
                           focus:outline-none focus:border-brasa-600 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-carbon-400 mb-1.5">Cidade</label>
              <input
                type="text"
                placeholder="Cidade"
                value={end.cidade}
                onChange={e => { setEnd(p => ({ ...p, cidade: e.target.value })); setFreteInfo(null) }}
                className="w-full bg-carbon-900 border border-carbon-700 rounded-xl
                           px-4 py-3 text-carbon-50 placeholder-carbon-500 text-sm
                           focus:outline-none focus:border-brasa-600 transition-colors"
              />
            </div>
          </div>

          {/* Botão calcular frete */}
          <button
            onClick={handleCalcularFrete}
            disabled={calculandoFrete || !end.logradouro || !end.numero}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-colors
                       bg-carbon-700 hover:bg-carbon-600 text-carbon-100
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calculandoFrete ? 'Calculando…' : '🛵  Calcular entrega'}
          </button>

          {/* Resultado do frete */}
          {freteInfo && (
            <div className={`rounded-xl px-4 py-3 text-sm
              ${freteInfo.entrega
                ? 'bg-green-900/30 border border-green-700/50 text-green-300'
                : 'bg-red-900/30  border border-red-700/50  text-red-300'
              }`}
            >
              {freteInfo.entrega ? (
                <>
                  <p className="font-semibold">✅ Entrega disponível</p>
                  <p className="text-xs mt-0.5 opacity-80">
                    {freteInfo.label} · {freteInfo.distancia_km.toFixed(1)} km
                  </p>
                  <p className="font-bold text-base mt-1">
                    Taxa: {formatPreco(freteInfo.preco)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">❌ {freteInfo.label}</p>
                  <p className="text-xs mt-0.5 opacity-80">
                    Distância: {freteInfo.distancia_km?.toFixed(1)} km — fora da área de entrega.
                  </p>
                </>
              )}
            </div>
          )}

          {erroFrete && (
            <p className="text-xs text-red-400">{erroFrete}</p>
          )}
        </section>

        {/* ========= SEÇÃO: RESUMO DO PEDIDO ========= */}
        <section className="bg-carbon-800 rounded-2xl px-5 py-5 space-y-3">
          <h2 className="font-bold text-carbon-50">🛒 Resumo do pedido</h2>

          {itens.map(item => (
            <div key={item.itemId} className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-carbon-100 font-medium leading-snug truncate">
                  {item.quantidade}× {item.produto.nome}
                </p>
                {item.complementos.length > 0 && (
                  <p className="text-xs text-carbon-500 leading-snug mt-0.5">
                    {item.complementos.map(c => c.nome).join(', ')}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold text-brasa-400 flex-shrink-0">
                {formatPreco(item.subtotal)}
              </span>
            </div>
          ))}

          <div className="border-t border-carbon-700 pt-3 space-y-2">
            <div className="flex justify-between text-sm text-carbon-400">
              <span>Subtotal</span>
              <span>{formatPreco(subtotal)}</span>
            </div>

            {freteInfo?.entrega && (
              <div className="flex justify-between text-sm text-carbon-400">
                <span>Taxa de entrega</span>
                <span>{formatPreco(freteInfo.preco)}</span>
              </div>
            )}

            {!freteInfo && (
              <div className="flex justify-between text-sm text-carbon-500 italic">
                <span>Taxa de entrega</span>
                <span>a calcular</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-carbon-50 text-base pt-1">
              <span>Total</span>
              <span className="text-brasa-400">{formatPreco(totalFinal)}</span>
            </div>
          </div>
        </section>

        {/* ========= SEÇÃO: PAGAMENTO ========= */}
        <section className="bg-carbon-800 rounded-2xl px-5 py-5 space-y-3">
          <h2 className="font-bold text-carbon-50">💳 Pagamento</h2>
          <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Ícone PIX */}
              <div className="w-10 h-10 bg-green-700/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-400" viewBox="0 0 512 512" fill="currentColor">
                  <path d="M242.4 292.5C247.8 287.1 259.1 287.1 264.4 292.5L354.7 382.8C360.1 388.2 360.1 396.9 354.7 402.3L264.4 492.6C259.1 498 247.8 498 242.4 492.6L152.1 402.3C146.7 396.9 146.7 388.2 152.1 382.8L242.4 292.5zM398.3 172.3L509.5 283.6C514.9 289 514.9 297.7 509.5 303.1L398.3 414.3C392.9 419.7 384.2 419.7 378.8 414.3L267.6 303.1C262.2 297.7 262.2 289 267.6 283.6L378.8 172.3C384.2 166.9 392.9 166.9 398.3 172.3zM113.7 172.3C119.1 166.9 127.8 166.9 133.2 172.3L244.4 283.6C249.8 289 249.8 297.7 244.4 303.1L133.2 414.3C127.8 419.7 119.1 419.7 113.7 414.3L2.5 303.1C-2.9 297.7-2.9 289 2.5 283.6L113.7 172.3zM242.4 19.4C247.8 14 259.1 14 264.4 19.4L354.7 109.7C360.1 115.1 360.1 123.8 354.7 129.2L264.4 219.5C259.1 224.9 247.8 224.9 242.4 219.5L152.1 129.2C146.7 123.8 146.7 115.1 152.1 109.7L242.4 19.4z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-green-300">PIX</p>
                <p className="text-xs text-carbon-400">
                  QR Code gerado após confirmação · expira em 30 min
                </p>
              </div>
              <div className="ml-auto w-5 h-5 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          <p className="text-xs text-carbon-500 text-center">
            Cartão de crédito disponível em breve
          </p>
        </section>

        {/* ========= ERRO ========= */}
        {erroPedido && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl
                          px-4 py-3 text-sm text-red-300">
            {erroPedido}
          </div>
        )}

        {/* ========= BOTÃO CONFIRMAR ========= */}
        <button
          onClick={handleConfirmar}
          disabled={enviando || !freteInfo?.entrega || itens.length === 0}
          className="btn-primary w-full py-4 text-base disabled:opacity-50
                     disabled:cursor-not-allowed"
        >
          {enviando
            ? 'Registrando pedido…'
            : `🔥 Ir para pagamento · ${formatPreco(totalFinal)}`
          }
        </button>

        {!freteInfo && (
          <p className="text-center text-xs text-carbon-500">
            Calcule o frete para habilitar a confirmação
          </p>
        )}

        <div className="pb-8" />
      </main>
    </div>
  )
}
