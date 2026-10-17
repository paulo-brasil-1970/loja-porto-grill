import { create } from 'zustand'

// Cada item do carrinho tem a forma:
// {
//   itemId: string (uuid gerado localmente para identificar a linha),
//   produto: { id, nome, preco },
//   complementos: [{ id, nome, preco_adicional, grupo_nome }],
//   quantidade: number,
//   subtotal: number,    // (produto.preco + Σ preco_adicional) × quantidade
// }

function calcSubtotal(preco, complementos, quantidade) {
  const extras = complementos.reduce((acc, c) => acc + (c.preco_adicional || 0), 0)
  return (preco + extras) * quantidade
}

export const useCarrinho = create((set, get) => ({
  itens: [],
  aberto: false,

  // Abre/fecha o painel lateral do carrinho
  toggleCarrinho: () => set(s => ({ aberto: !s.aberto })),
  fecharCarrinho: () => set({ aberto: false }),

  // Adiciona um item com seus complementos selecionados
  adicionarItem: (produto, complementosSelecionados, quantidade = 1) => {
    const itemId = crypto.randomUUID()
    const subtotal = calcSubtotal(produto.preco, complementosSelecionados, quantidade)
    set(s => ({
      itens: [...s.itens, { itemId, produto, complementos: complementosSelecionados, quantidade, subtotal }],
      aberto: true,   // abre o carrinho automaticamente ao adicionar
    }))
  },

  // Altera a quantidade de um item; remove se chegar a 0
  alterarQuantidade: (itemId, delta) => {
    set(s => {
      const itens = s.itens.map(item => {
        if (item.itemId !== itemId) return item
        const novaQtd = item.quantidade + delta
        if (novaQtd <= 0) return null
        return {
          ...item,
          quantidade: novaQtd,
          subtotal: calcSubtotal(item.produto.preco, item.complementos, novaQtd),
        }
      }).filter(Boolean)
      return { itens }
    })
  },

  // Remove um item pelo itemId
  removerItem: (itemId) => set(s => ({ itens: s.itens.filter(i => i.itemId !== itemId) })),

  // Esvazia o carrinho
  limparCarrinho: () => set({ itens: [] }),

  // Total geral
  get total() {
    return get().itens.reduce((acc, i) => acc + i.subtotal, 0)
  },

  // Quantidade total de itens (soma das quantidades)
  get totalItens() {
    return get().itens.reduce((acc, i) => acc + i.quantidade, 0)
  },
}))

// Seletores computados como hooks para não recomputar em todo render
export const useCarrinhoTotal = () =>
  useCarrinho(s => s.itens.reduce((acc, i) => acc + i.subtotal, 0))

export const useCarrinhoTotalItens = () =>
  useCarrinho(s => s.itens.reduce((acc, i) => acc + i.quantidade, 0))
