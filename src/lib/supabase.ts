import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** true somente quando ambas as variáveis de ambiente estão presentes. */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // No APK standalone, env ausente faria o createClient lançar erro no import
  // e crashar o app na inicialização. Avisamos e usamos placeholders seguros;
  // a UI mostra uma tela amigável de "configuração ausente".
  console.warn(
    '[Eva Ambiental] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY ausentes no build. ' +
      'Configure as variáveis (eas.json env ou .env) antes de gerar o APK.'
  );
}

// Placeholders válidos evitam que o createClient lance erro quando a env falta.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'public-anon-placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export const PHOTO_BUCKET = 'weighing-photos';
