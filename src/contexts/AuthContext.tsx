import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';
import { describeProfileError, validateProfile } from '@/utils/authErrors';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Mensagem amigável quando o login ocorre mas o perfil não pode ser usado
   *  (inativo, sem perfil, role inválido, permissão, rede). null = sem problema. */
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
  const [authError, setAuthError] = useState<string | null>(null);

  // Preserva a authError durante o signOut forçado de um perfil inválido,
  // evitando que o evento SIGNED_OUT limpe a mensagem antes de exibi-la.
  const preserveError = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Log do erro real (sem dados sensíveis) para diagnóstico.
        console.warn('[Auth] Falha ao carregar perfil:', error.code, '-', error.message);
        const issue = describeProfileError(error);
        setProfile(null);
        setAuthError(issue.message);
        if (issue.signOut) {
          preserveError.current = true;
          await supabase.auth.signOut();
        }
        return;
      }

      // Valida ativo + role válido
      const invalid = validateProfile(data);
      if (invalid) {
        console.warn('[Auth] Perfil inválido:', invalid.kind);
        setProfile(null);
        setAuthError(invalid.message);
        if (invalid.signOut) {
          preserveError.current = true;
          await supabase.auth.signOut();
        }
        return;
      }

      setProfile(data as Profile);
      setAuthError(null);
    } catch (e: any) {
      console.warn('[Auth] Exceção ao carregar perfil:', e?.message);
      setProfile(null);
      setAuthError('Não foi possível conectar ao Supabase. Verifique a internet e as variáveis do ambiente.');
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
      .catch((e) => {
        console.warn('[Auth] getSession falhou:', e?.message);
        if (mounted) {
          setAuthError('Não foi possível conectar ao Supabase. Verifique a internet e as variáveis do ambiente.');
        }
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
        if (preserveError.current) {
          // signOut forçado de perfil inválido: preserva a mensagem já definida.
          preserveError.current = false;
        } else {
          setAuthError(null);
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    preserveError.current = false;
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    preserveError.current = false;
    await supabase.auth.signOut();
    setProfile(null);
    setAuthError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, authError, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
