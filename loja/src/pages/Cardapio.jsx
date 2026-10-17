// Cardapio.jsx — Página principal da loja Porto Grill
// Responsabilidades:
//   1. Buscar categorias + produtos do Supabase em um único request
//   2. Renderizar o header, a nav de categorias, as seções e os cards
//   3. Gerenciar qual produto está com o modal aberto

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import CategoriaNav from '../components/CategoriaNav'
import ProdutoCard from '../components/ProdutoCard'
import ComplementoModal from '../components/ComplementoModal'
import Carrinho from '../components/Carrinho'
import { useCarrinho, useCarrinhoTotalItens } from '../store/carrinho'

// Lista de categorias que têm grupos de complemento no banco.
// Usada para decidir se abre o modal ou adiciona direto ao carrinho.
const CATS_COM_COMPLEMENTO = new Set([
  'Preparados na Brasa',
  'Cortes Premium',
  'Sugestão do Chef',
  'Combo Coca Cola',
])

function temComplemento(produto, categoriaNome) {
  return CATS_COM_COMPLEMENTO.has(categoriaNome)
}

export default function Cardapio() {
  const [categorias, setCategorias] = useState([])   // [{ id, nome, ordem, produtos: [...] }]
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [produtoModal, setProdutoModal] = useState(null)  // produto aberto no modal

  const toggleCarrinho = useCarrinho(s => s.toggleCarrinho)
  const adicionarItem  = useCarrinho(s => s.adicionarItem)
  const totalItens     = useCarrinhoTotalItens()

  useEffect(() => {
    async function carregarCardapio() {
      setCarregando(true)
      setErro(null)

      // Um único request busca categorias com seus produtos aninhados.
      // O Supabase resolve o join automaticamente via foreign key.
      const { data, error } = await supabase
        .from('categorias')
        .select(`
          id, nome, descricao, ordem,
          produtos (id, nome, descricao, preco, disponivel, foto_url, ordem)
        `)
        .eq('ativo', true)
        .order('ordem', { ascending: true })

      if (error) {
        setErro('Não foi possível carregar o cardápio. Tente novamente.')
        setCarregando(false)
        return
      }

      // Ordena produtos dentro de cada categoria e filtra categorias sem produtos
      const processadas = (data || [])
        .map(cat => ({
          ...cat,
          produtos: (cat.produtos || []).sort((a, b) => a.ordem - b.ordem),
        }))
        .filter(cat => cat.produtos.length > 0)

      setCategorias(processadas)
      setCarregando(false)
    }

    carregarCardapio()
  }, [])

  function abrirModal(produto) {
    setProdutoModal(produto)
  }

  // Para produtos sem complementos, adiciona direto (Sprint 2: bebidas, entradas simples)
  function handleProdutoClick(produto, categoriaNome) {
    if (temComplemento(produto, categoriaNome)) {
      abrirModal(produto)
    } else {
      adicionarItem(produto, [], 1)
    }
  }

  return (
    <div className="min-h-screen bg-carbon-900">
      {/* ========= HEADER ========= */}
      <header className="sticky top-0 z-40 bg-carbon-950/95 backdrop-blur
                         border-b border-carbon-800 px-4 py-3
                         flex items-center justify-between gap-4">
        {/* Logo / nome */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brasa-600 flex items-center
                          justify-center text-white font-bold text-sm flex-shrink-0">
            PG
          </div>
          <div>
            <h1 className="font-bold text-carbon-50 text-sm leading-none">Porto Grill</h1>
            <p className="text-xs text-carbon-400 mt-0.5">Praia Brava · Itajaí SC</p>
          </div>
        </div>

        {/* Botão carrinho */}
        <button
          onClick={toggleCarrinho}
          className="relative flex items-center gap-2 bg-carbon-800
                     hover:bg-carbon-700 transition-colors rounded-xl px-4 py-2"
          aria-label="Abrir carrinho"
        >
          <span className="text-lg">🛒</span>
          <span className="text-sm font-medium text-carbon-100">Carrinho</span>
          {totalItens > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-brasa-600 text-white
                             text-xs font-bold rounded-full min-w-[20px] h-5
                             flex items-center justify-center px-1">
              {totalItens}
            </span>
          )}
        </button>
      </header>

      {/* ========= NAV DE CATEGORIAS ========= */}
      {!carregando && !erro && (
        <CategoriaNav categorias={categorias} />
      )}

      {/* ========= CONTEÚDO ========= */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-10">

        {/* Estado: carregando */}
        {carregando && (
          <div className="flex flex-col items-center gap-4 py-20 text-carbon-400">
            <div className="w-10 h-10 border-2 border-brasa-600 border-t-transparent
                            rounded-full animate-spin" />
            <p className="text-sm">Carregando cardápio…</p>
          </div>
        )}

        {/* Estado: erro */}
        {erro && (
          <div className="flex flex-col items-center gap-4 py-20">
            <p className="text-red-400">{erro}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Seções por categoria */}
        {!carregando && !erro && categorias.map(cat => (
          <section key={cat.id} id={`cat-${cat.id}`} data-categoria-id={cat.id}>
            {/* Título da categoria */}
            <h2 className="font-bold text-xl text-carbon-50 mb-1">{cat.nome}</h2>
            {cat.descricao && (
              <p className="text-sm text-carbon-400 mb-4">{cat.descricao}</p>
            )}

            {/* Grid de produtos */}
            <div className="space-y-3">
              {cat.produtos.map(produto => (
                <ProdutoCard
                  key={produto.id}
                  produto={produto}
                  onAbrirModal={() => handleProdutoClick(produto, cat.nome)}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Footer discreto */}
        {!carregando && !erro && (
          <footer className="text-center text-xs text-carbon-600 pb-4">
            Porto Grill · Praia Brava, Itajaí SC · (47) XXXX-XXXX
          </footer>
        )}
      </main>

      {/* ========= MODAL DE COMPLEMENTOS ========= */}
      {produtoModal && (
        <ComplementoModal
          produto={produtoModal}
          onFechar={() => setProdutoModal(null)}
        />
      )}

      {/* ========= CARRINHO (drawer lateral) ========= */}
      <Carrinho />
    </div>
  )
}
