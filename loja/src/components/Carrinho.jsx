// Carrinho.jsx
// Painel lateral (drawer) que lista os itens do carrinho.
// Abre/fecha via store Zustand.
// Ainda sem checkout — botão "Finalizar pedido" será implementado no Sprint 3.

import { useNavigate } from 'react-router-dom'
import { useCarrinho, useCarrinhoTotal } from '../store/carrinho'

function formatPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Carrinho() {
  const navigate = useNavigate()
  const { itens, aberto, fecharCarrinho, alterarQuantidade, removerItem } = useCarrinho()
  const total = useCarrinhoTotal()

  return (
    <>
      {/* Overlay escurecido */}
      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={fecharCarrinho}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-96
                    bg-carbon-800 shadow-2xl flex flex-col
                    transition-transform duration-300 ease-in-out
                    ${aberto ? 'translate-x-0' : 'translate-x-full'}`}
        aria-label="Carrinho de compras"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-carbon-700">
          <h2 className="font-bold text-lg text-carbon-50">Meu pedido</h2>
          <button
            onClick={fecharCarrinho}
            className="w-9 h-9 rounded-full bg-carbon-700 hover:bg-carbon-600
                       flex items-center justify-center text-carbon-400
                       hover:text-carbon-50 transition-colors"
            aria-label="Fechar carrinho"
          >
            ✕
          </button>
        </div>

        {/* Lista de itens */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full
                            text-carbon-500 gap-3">
              <span className="text-5xl">🛒</span>
              <p className="text-sm">Seu carrinho está vazio</p>
            </div>
          ) : (
            itens.map(item => (
              <div key={item.itemId}
                   className="bg-carbon-900 rounded-xl p-4 space-y-2">
                {/* Nome + remover */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-carbon-50 text-sm leading-snug">
                    {item.produto.nome}
                  </p>
                  <button
                    onClick={() => removerItem(item.itemId)}
                    className="text-carbon-500 hover:text-red-400 transition-colors
                               text-xs flex-shrink-0 mt-0.5"
                    aria-label="Remover item"
                  >
                    Remover
                  </button>
                </div>

                {/* Complementos selecionados */}
                {item.complementos.length > 0 && (
                  <ul className="space-y-0.5">
                    {item.complementos.map(c => (
                      <li key={c.id} className="text-xs text-carbon-400 flex justify-between">
                        <span>· {c.nome}</span>
                        {c.preco_adicional > 0 && (
                          <span className="text-brasa-400">
                            {formatPreco(c.preco_adicional)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Quantidade + subtotal */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => alterarQuantidade(item.itemId, -1)}
                      className="w-7 h-7 rounded-full border border-carbon-600
                                 hover:border-brasa-600 text-carbon-300 hover:text-white
                                 transition-colors text-base flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold text-carbon-50 w-4 text-center">
                      {item.quantidade}
                    </span>
                    <button
                      onClick={() => alterarQuantidade(item.itemId, +1)}
                      className="w-7 h-7 rounded-full border border-carbon-600
                                 hover:border-brasa-600 text-carbon-300 hover:text-white
                                 transition-colors text-base flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-bold text-brasa-400 text-sm">
                    {formatPreco(item.subtotal)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé */}
        {itens.length > 0 && (
          <div className="px-5 py-4 border-t border-carbon-700 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-carbon-400 text-sm">Subtotal</span>
              <span className="font-bold text-carbon-50">{formatPreco(total)}</span>
            </div>
            <p className="text-xs text-carbon-500 text-center">
              Taxa de entrega calculada no próximo passo
            </p>
            <button
              className="btn-primary w-full"
              onClick={() => { fecharCarrinho(); navigate('/checkout') }}
            >
              Finalizar pedido · {formatPreco(total)}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
