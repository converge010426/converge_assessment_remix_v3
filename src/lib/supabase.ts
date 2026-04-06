import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

export const getSupabase = (useServiceRole = false) => {
  // We don't cache the service role client to avoid accidental leaks
  if (supabaseClient && !useServiceRole) return supabaseClient;

  const rawUrl = (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined) || 
                 (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_URL : undefined);
  
  const anonKey = (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined) || 
                  (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY : undefined);
  
  const serviceKey = (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);

  const supabaseUrl = rawUrl?.replace(/^[•\s\t]+/, '').trim();
  const supabaseAnonKey = anonKey?.replace(/^[•\s\t]+/, '').trim();
  const supabaseServiceKey = serviceKey?.replace(/^[•\s\t]+/, '').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
    throw new Error(`Supabase configuration is incomplete. Missing: ${missing.join(', ')}.`);
  }

  // Use service key if requested and available, otherwise fallback to anon
  const finalKey = (useServiceRole && supabaseServiceKey) ? supabaseServiceKey : supabaseAnonKey;
  
  const client = createClient(supabaseUrl, finalKey);
  if (!useServiceRole) supabaseClient = client;
  return client;
};
