// ComplementoModal.jsx
// Modal de personalização do pedido.
// Carrega grupos_complemento + itens_complemento do produto via Supabase.
//
// Regras de seleção por grupo:
//   obrigatorio=true,  min=1, max=1  → radio (Escolha o ponto)
//   obrigatorio=false, min=0, max=3  → checkbox com limite (Acompanhamentos inclusos)
//   obrigatorio=false, min=0, max=10 → checkbox com preço (Adicionais pagos)

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCarrinho } from '../store/carrinho'

function formatPreco(valor) {
  if (!valor) return 'Grátis'
  return `+ ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
}

function calcTotal(produto, selecoesPorGrupo) {
  const extras = Object.values(selecoesPorGrupo)
    .flat()
    .reduce((acc, item) => acc + (item.preco_adicional || 0), 0)
  return produto.preco + extras
}

export default function ComplementoModal({ produto, onFechar }) {
  const [grupos, setGrupos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  // { [grupo_id]: [item, ...] }
  const [selecoes, setSelecoes] = useState({})
  const [quantidade, setQuantidade] = useState(1)
  const overlayRef = useRef(null)
  const adicionarItem = useCarrinho(s => s.adicionarItem)

  // Carrega grupos e itens do produto
  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      setErro(null)
      const { data, error } = await supabase
        .from('grupos_complemento')
        .select(`
          id, nome, descricao, obrigatorio, min_selecoes, max_selecoes, ordem,
          itens_complemento (id, nome, preco_adicional, disponivel)
        `)
        .eq('produto_id', produto.id)
        .order('ordem')

      if (error) {
        setErro('Não foi possível carregar as opções. Tente novamente.')
      } else {
        // Ordena itens dentro de cada grupo pelo nome
        const ordenados = (data || []).map(g => ({
          ...g,
          itens_complemento: (g.itens_complemento || [])
            .filter(i => i.disponivel)
            .sort((a, b) => a.nome.localeCompare(b.nome))
        }))
        setGrupos(ordenados)
      }
      setCarregando(false)
    }
    carregar()
  }, [produto.id])

  // Fecha ao clicar no overlay (fora do modal)
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onFechar()
  }

  // Fecha com Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  // --- Lógica de seleção ---

  function selecionarRadio(grupo, item) {
    setSelecoes(s => ({ ...s, [grupo.id]: [item] }))
  }

  function toggleCheckbox(grupo, item) {
    setSelecoes(prev => {
      const atuais = prev[grupo.id] || []
      const jaSelected = atuais.some(i => i.id === item.id)

      if (jaSelected) {
        return { ...prev, [grupo.id]: atuais.filter(i => i.id !== item.id) }
      }
      // Respeita max_selecoes
      if (atuais.length >= grupo.max_selecoes) return prev
      return { ...prev, [grupo.id]: [...atuais, item] }
    })
  }

  // Verifica se todos os grupos obrigatórios estão satisfeitos
  const podeContinuar = grupos
    .filter(g => g.obrigatorio)
    .every(g => {
      const sel = selecoes[g.id] || []
      return sel.length >= g.min_selecoes
    })

  // Todos os itens selecionados como lista plana (para o carrinho)
  function complementosSelecionados() {
    return Object.entries(selecoes).flatMap(([grupoId, itens]) => {
      const grupo = grupos.find(g => g.id === grupoId)
      return itens.map(i => ({ ...i, grupo_nome: grupo?.nome }))
    })
  }

  function confirmar() {
    adicionarItem(produto, complementosSelecionados(), quantidade)
    onFechar()
  }

  const total = calcTotal(produto, selecoes)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center
                 justify-center p-0 sm:p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-carbon-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl
                   max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-carbon-700">
          <div>
            <h2 className="font-bold text-lg text-carbon-50">{produto.nome}</h2>
            <p className="text-brasa-400 font-semibold">
              {produto.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="w-9 h-9 rounded-full bg-carbon-700 hover:bg-carbon-600
                       flex items-center justify-center text-carbon-400
                       hover:text-carbon-50 transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
          {carregando && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-brasa-600 border-t-transparent
                              rounded-full animate-spin" />
            </div>
          )}

          {erro && (
            <p className="text-red-400 text-center py-4">{erro}</p>
          )}

          {!carregando && !erro && grupos.map(grupo => (
            <section key={grupo.id}>
              {/* Cabeçalho do grupo */}
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-carbon-50">{grupo.nome}</h3>
                  {grupo.descricao && (
                    <p className="text-xs text-carbon-400 mt-0.5">{grupo.descricao}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  grupo.obrigatorio
                    ? 'bg-brasa-600/20 text-brasa-400'
                    : 'bg-carbon-700 text-carbon-400'
                }`}>
                  {grupo.obrigatorio ? 'Obrigatório' : `Até ${grupo.max_selecoes}`}
                </span>
              </div>

              {/* Itens do grupo */}
              <div className="space-y-2">
                {grupo.itens_complemento.map(item => {
                  const ehRadio = grupo.max_selecoes === 1 && grupo.obrigatorio
                  const selecionados = selecoes[grupo.id] || []
                  const marcado = selecionados.some(i => i.id === item.id)
                  const limitAtingido = !marcado && selecionados.length >= grupo.max_selecoes

                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer
                                  border transition-colors duration-100 ${
                        marcado
                          ? 'border-brasa-600 bg-brasa-600/10'
                          : limitAtingido
                          ? 'border-carbon-700 opacity-40 cursor-not-allowed'
                          : 'border-carbon-700 hover:border-carbon-500'
                      }`}
                    >
                      <input
                        type={ehRadio ? 'radio' : 'checkbox'}
                        name={grupo.id}
                        checked={marcado}
                        disabled={!marcado && limitAtingido}
                        onChange={() => {
                          if (ehRadio) selecionarRadio(grupo, item)
                          else toggleCheckbox(grupo, item)
                        }}
                        className="accent-brasa-600 w-4 h-4 flex-shrink-0"
                      />
                      <span className="flex-1 text-sm text-carbon-100">{item.nome}</span>
                      <span className={`text-sm font-medium ${
                        item.preco_adicional > 0 ? 'text-brasa-400' : 'text-carbon-400'
                      }`}>
                        {formatPreco(item.preco_adicional)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Rodapé: quantidade + botão */}
        <div className="px-5 py-4 border-t border-carbon-700 space-y-3">
          {/* Controle de quantidade */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setQuantidade(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-full border border-carbon-600
                         hover:border-brasa-600 text-xl text-carbon-300
                         hover:text-white transition-colors flex items-center justify-center"
            >
              −
            </button>
            <span className="font-bold text-lg text-carbon-50 w-8 text-center">
              {quantidade}
            </span>
            <button
              onClick={() => setQuantidade(q => q + 1)}
              className="w-10 h-10 rounded-full border border-carbon-600
                         hover:border-brasa-600 text-xl text-carbon-300
                         hover:text-white transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>

          {/* Botão confirmar */}
          <button
            onClick={confirmar}
            disabled={!podeContinuar || carregando}
            className="btn-primary w-full flex items-center justify-between"
          >
            <span>Adicionar ao pedido</span>
            <span className="font-bold">
              {(total * quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
