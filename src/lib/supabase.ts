import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

export const getSupabase = () => {
  if (supabaseClient) return supabaseClient;

  const rawUrl = (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined) || 
                 (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_URL : undefined);
  const rawKey = (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined) || 
                 (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY : undefined);

  const supabaseUrl = rawUrl?.replace(/^[•\s\t]+/, '').trim();
  const supabaseAnonKey = rawKey?.replace(/^[•\s\t]+/, '').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
    throw new Error(`Supabase configuration is incomplete. Missing: ${missing.join(', ')}. Please set these variables in the Settings menu or a .env file.`);
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
};
