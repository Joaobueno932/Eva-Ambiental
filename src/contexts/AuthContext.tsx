import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** true quando o usuário autenticou mas está inativo/sem perfil (acesso negado) */
  blocked: boolean;
  /** mensagem amigável para falhas transitórias (rede/servidor) ao carregar o perfil */
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Preserva o estado "blocked" durante o signOut forçado de um usuário inativo,
  // evitando que o evento SIGNED_OUT limpe a mensagem antes de exibi-la.
  const keepBlocked = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // PGRST116 = nenhuma linha encontrada (perfil inexistente) -> sem acesso.
        if (error.code === 'PGRST116') {
          keepBlocked.current = true;
          setProfile(null);
          setBlocked(true);
          setAuthError(null);
          await supabase.auth.signOut();
        } else {
          // Falha de rede/servidor: transitória — não tratar como inativo.
          setProfile(null);
          setBlocked(false);
          setAuthError('Não foi possível carregar seu perfil. Verifique sua conexão e tente novamente.');
        }
        return;
      }

      if (!data || !data.active) {
        // Usuário inativo (ou sem perfil) não acessa o sistema.
        keepBlocked.current = true;
        setProfile(null);
        setBlocked(true);
        setAuthError(null);
        await supabase.auth.signOut();
        return;
      }

      setProfile(data as Profile);
      setBlocked(false);
      setAuthError(null);
    } catch {
      // Exceção de rede inesperada — mantém o usuário fora, sem mensagem enganosa.
      setProfile(null);
      setBlocked(false);
      setAuthError('Falha de conexão. Tente novamente em instantes.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        }
      })
      .catch(() => {
        if (mounted) setAuthError('Falha de conexão ao iniciar. Tente novamente.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        if (keepBlocked.current) {
          // signOut forçado de inativo: preserva o banner já definido.
          keepBlocked.current = false;
        } else {
          setBlocked(false);
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Limpa estados anteriores ao iniciar nova tentativa.
    setBlocked(false);
    setAuthError(null);
    keepBlocked.current = false;
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    keepBlocked.current = false;
    await supabase.auth.signOut();
    setProfile(null);
    setBlocked(false);
    setAuthError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, blocked, authError, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
