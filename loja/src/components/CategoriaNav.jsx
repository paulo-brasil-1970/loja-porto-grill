// CategoriaNav.jsx
import { useEffect, useRef, useState } from 'react'

export default function CategoriaNav({ categorias }) {
  const [ativa, setAtiva] = useState(null)
  const [headerH, setHeaderH] = useState(60)
  const navRef       = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
    function medir() {
      const h = document.querySelector('header')
      if (h) setHeaderH(h.getBoundingClientRect().height)
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  useEffect(() => {
    if (!categorias.length) return
    const observer = new IntersectionObserver(
      entries => {
        if (scrollingRef.current) return
        entries.forEach(entry => {
          if (entry.isIntersecting) setAtiva(entry.target.dataset.categoriaId)
        })
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    )
    categorias.forEach(cat => {
      const el = document.getElementById(`cat-${cat.id}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [categorias])

  function irParaCategoria(id) {
    const el = document.getElementById(`cat-${id}`)
    if (!el || !navRef.current) return

    scrollingRef.current = true
    setAtiva(String(id))
    setTimeout(() => { scrollingRef.current = false }, 800)

    const navBottom = navRef.current.getBoundingClientRect().bottom

    // 1ª passagem: scroll instantâneo para forçar carregamento das imagens lazy
    //              acima da seção-alvo (elas têm h=0 antes de entrar no viewport)
    const elTop1 = el.getBoundingClientRect().top + window.scrollY
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, elTop1 - navBottom - 8)

    // 2ª passagem: após 1 frame as imagens lazy expandiram → recalcula posição final
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const elTop2 = el.getBoundingClientRect().top + window.scrollY
        document.documentElement.style.scrollBehavior = ''   // restaura smooth do CSS
        window.scrollTo({ top: elTop2 - navBottom - 8, behavior: 'smooth' })
      })
    })
  }

  useEffect(() => {
    if (!ativa || !navRef.current) return
    const btn = navRef.current.querySelector(`[data-id="${ativa}"]`)
    if (btn) btn.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [ativa])

  return (
    <nav
      ref={navRef}
      className="z-30 bg-carbon-900/95 backdrop-blur border-b border-carbon-700
                 overflow-x-auto no-scrollbar flex gap-1 px-4 py-2"
      style={{ position: 'sticky', top: `${headerH}px`, WebkitOverflowScrolling: 'touch' }}
    >
      {categorias.map(cat => (
        <button
          key={cat.id}
          data-id={cat.id}
          onClick={() => irParaCategoria(cat.id)}
          className={`
            flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
            transition-colors duration-150 whitespace-nowrap
            ${ativa === String(cat.id)
              ? 'bg-brasa-600 text-white'
              : 'text-carbon-400 hover:text-carbon-50 hover:bg-carbon-800'
            }
          `}
        >
          {cat.nome}
        </button>
      ))}
    </nav>
  )
}
