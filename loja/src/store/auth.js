// ================================================================
// store/auth.js — Estado de autenticação com Supabase Auth
// ================================================================
// Zustand store global para sessão do usuário.
// Inicialize com useAuth.getState().inicializar() no topo da árvore
// (feito em main.jsx via useEffect).
// ================================================================
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuth = create((set) => ({
  // Estado inicial
  session:    null,   // objeto Session do Supabase
  usuario:    null,   // objeto User do Supabase (session.user)
  carregando: true,   // true até a primeira verificação de sessão

  /**
   * Chama getSession() e registra o listener onAuthStateChange.
   * Deve ser chamado UMA VEZ no App root via useEffect.
   */
  inicializar: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    set({
      session,
      usuario:    session?.user ?? null,
      carregando: false,
    })

    // Listener reativo — atualiza o store em login/logout/refresh
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, usuario: session?.user ?? null })
    })
  },

  /**
   * Login com email + senha.
   * Lança Error em caso de credenciais inválidas.
   */
  login: async (email, senha) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })
    if (error) throw error
    return data
  },

  /**
   * Cadastro de novo usuário.
   * Armazena nome_completo e telefone em user_metadata.
   *
   * ATENÇÃO: se "Confirm email" estiver ativado no Supabase Auth,
   * o usuário precisa verificar o e-mail antes de fazer login.
   * Para desativar: Authentication > Providers > Email > uncheck "Confirm email".
   */
  cadastrar: async (email, senha, nome, telefone) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome_completo: nome,
          telefone:      telefone || '',
        },
      },
    })
    if (error) throw error
    return data
  },

  /**
   * Logout — limpa sessão local e no servidor.
   */
  logout: async () => {
    await supabase.auth.signOut()
    set({ session: null, usuario: null })
  },
}))
