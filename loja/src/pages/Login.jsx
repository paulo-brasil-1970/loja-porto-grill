// Login.jsx — Página de autenticação (login + cadastro)
// Fluxo: usuário chega aqui quando tenta acessar /checkout sem sessão.
// Após autenticação, volta para a rota de origem (state.from) ou para /.

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'

function formatarTelefone(valor) {
  const s = valor.replace(/\D/g, '').slice(0, 11)
  if (s.length <= 2)  return s
  if (s.length <= 7)  return `(${s.slice(0,2)}) ${s.slice(2)}`
  if (s.length <= 11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`
  return valor
}

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const destino   = location.state?.from || '/'

  const { login, cadastrar } = useAuth()

  const [aba, setAba]       = useState('entrar') // 'entrar' | 'cadastrar'
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro]     = useState('')
  const [aviso, setAviso]   = useState('') // confirmação de e-mail

  // Campos de login
  const [loginEmail, setLoginEmail]   = useState('')
  const [loginSenha, setLoginSenha]   = useState('')

  // Campos de cadastro
  const [cadNome,     setCadNome]     = useState('')
  const [cadEmail,    setCadEmail]    = useState('')
  const [cadTelefone, setCadTelefone] = useState('')
  const [cadSenha,    setCadSenha]    = useState('')
  const [cadSenha2,   setCadSenha2]   = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await login(loginEmail.trim(), loginSenha)
      navigate(destino, { replace: true })
    } catch (err) {
      setErro(traduzirErro(err.message))
    } finally {
      setCarregando(false)
    }
  }

  async function handleCadastro(e) {
    e.preventDefault()
    setErro('')
    if (cadSenha !== cadSenha2) {
      setErro('As senhas não coincidem.')
      return
    }
    if (cadSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setCarregando(true)
    try {
      const { session } = await cadastrar(
        cadEmail.trim(),
        cadSenha,
        cadNome.trim(),
        cadTelefone.replace(/\D/g, ''),
      )
      if (session) {
        // Confirmação de e-mail desativada — login imediato
        navigate(destino, { replace: true })
      } else {
        // Confirmação de e-mail ativada no Supabase
        setAviso('Cadastro realizado! Verifique seu e-mail para confirmar a conta e depois faça login.')
        setAba('entrar')
      }
    } catch (err) {
      setErro(traduzirErro(err.message))
    } finally {
      setCarregando(false)
    }
  }

  function traduzirErro(msg) {
    if (!msg) return 'Erro desconhecido. Tente novamente.'
    if (msg.includes('Invalid login credentials'))  return 'E-mail ou senha incorretos.'
    if (msg.includes('Email not confirmed'))        return 'Confirme seu e-mail antes de fazer login.'
    if (msg.includes('User already registered'))   return 'Este e-mail já está cadastrado. Faça login.'
    if (msg.includes('Password should be'))        return 'A senha deve ter pelo menos 6 caracteres.'
    if (msg.includes('Unable to validate email'))  return 'E-mail inválido.'
    return msg
  }

  const inputClass =
    'w-full bg-carbon-900 border border-carbon-700 rounded-xl px-4 py-3 ' +
    'text-carbon-50 placeholder-carbon-500 text-sm ' +
    'focus:outline-none focus:border-brasa-600 transition-colors'

  return (
    <div className="min-h-screen bg-carbon-900 flex flex-col items-center justify-center px-4 py-10">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-brasa-600 flex items-center
                        justify-center text-white font-bold text-lg flex-shrink-0">
          PG
        </div>
        <div>
          <h1 className="font-bold text-carbon-50 text-xl leading-none">Porto Grill</h1>
          <p className="text-xs text-carbon-400 mt-0.5">Praia Brava · Itajaí SC</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-carbon-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Abas */}
        <div className="flex border-b border-carbon-700">
          {['entrar', 'cadastrar'].map(tab => (
            <button
              key={tab}
              onClick={() => { setAba(tab); setErro(''); setAviso('') }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors
                ${aba === tab
                  ? 'text-brasa-400 border-b-2 border-brasa-600 -mb-px'
                  : 'text-carbon-400 hover:text-carbon-200'
                }`}
            >
              {tab === 'entrar' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <div className="px-6 py-6">

          {/* Aviso de confirmação */}
          {aviso && (
            <div className="mb-4 bg-green-900/40 border border-green-700 rounded-xl
                            px-4 py-3 text-sm text-green-300">
              {aviso}
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="mb-4 bg-red-900/40 border border-red-700 rounded-xl
                            px-4 py-3 text-sm text-red-300">
              {erro}
            </div>
          )}

          {/* ===== ABA ENTRAR ===== */}
          {aba === 'entrar' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-carbon-400 mb-1.5">E-mail</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-carbon-400 mb-1.5">Senha</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••"
                  value={loginSenha}
                  onChange={e => setLoginSenha(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={carregando}
                className="btn-primary w-full mt-2 disabled:opacity-60
                           disabled:cursor-not-allowed"
              >
                {carregando ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          )}

          {/* ===== ABA CADASTRAR ===== */}
          {aba === 'cadastrar' && (
            <form onSubmit={handleCadastro} className="space-y-4">
              <div>
                <label className="block text-xs text-carbon-400 mb-1.5">Nome completo</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="João Silva"
                  value={cadNome}
                  onChange={e => setCadNome(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-carbon-400 mb-1.5">E-mail</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={cadEmail}
                  onChange={e => setCadEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-carbon-400 mb-1.5">
                  WhatsApp / Telefone
                  <span className="text-carbon-600 ml-1">(opcional)</span>
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="(47) 99999-9999"
                  value={cadTelefone}
                  onChange={e => setCadTelefone(formatarTelefone(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-carbon-400 mb-1.5">Senha</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Mín. 6 caracteres"
                  value={cadSenha}
                  onChange={e => setCadSenha(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-carbon-400 mb-1.5">Confirmar senha</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  value={cadSenha2}
                  onChange={e => setCadSenha2(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={carregando}
                className="btn-primary w-full mt-2 disabled:opacity-60
                           disabled:cursor-not-allowed"
              >
                {carregando ? 'Criando conta…' : 'Criar conta'}
              </button>
            </form>
          )}

        </div>
      </div>

      {/* Link voltar */}
      <button
        onClick={() => navigate('/')}
        className="mt-6 text-xs text-carbon-500 hover:text-carbon-300 transition-colors"
      >
        ← Voltar ao cardápio
      </button>
    </div>
  )
}
