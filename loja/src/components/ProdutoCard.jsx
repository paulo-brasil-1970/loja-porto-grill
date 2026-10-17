// ProdutoCard.jsx
// Card de um produto. Mostra nome, descrição, preço e badge de indisponível.
// Clique abre o ComplementoModal (ou adiciona direto se não tiver complementos).

function formatPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ProdutoCard({ produto, onAbrirModal }) {
  const { nome, descricao, preco, disponivel, foto_url: imagem_url } = produto

  return (
    <div
      className={`produto-card flex gap-4 p-4 ${!disponivel ? 'opacity-50' : ''}`}
      onClick={() => disponivel && onAbrirModal(produto)}
      role={disponivel ? 'button' : undefined}
      aria-disabled={!disponivel}
      tabIndex={disponivel ? 0 : -1}
      onKeyDown={e => e.key === 'Enter' && disponivel && onAbrirModal(produto)}
    >
      {/* Imagem ou placeholder */}
      <div className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-carbon-700">
        {imagem_url ? (
          <img
            src={imagem_url}
            alt={nome}
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            🥩
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
        <div>
          <div className="flex items-start gap-2">
            <h3 className="font-semibold text-carbon-50 leading-snug">{nome}</h3>
            {!disponivel && (
              <span className="flex-shrink-0 text-xs bg-carbon-700 text-carbon-400
                               px-2 py-0.5 rounded-full">
                Indisponível
              </span>
            )}
          </div>
          {descricao && (
            <p className="text-sm text-carbon-400 mt-1 line-clamp-2">{descricao}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-bold text-brasa-400">{formatPreco(preco)}</span>
          {disponivel && (
            <button
              className="w-8 h-8 rounded-full bg-brasa-600 hover:bg-brasa-700
                         flex items-center justify-center text-white text-xl
                         transition-colors duration-150"
              onClick={e => { e.stopPropagation(); onAbrirModal(produto) }}
              aria-label={`Adicionar ${nome}`}
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
