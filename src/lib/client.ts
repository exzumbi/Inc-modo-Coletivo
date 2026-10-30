import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL || "",
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export function client() {
  if (!supabase) throw Error("O projeto Supabase ainda não foi conectado.");
  return supabase;
}
export async function ownerId() {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw Error("Sua sessão expirou. Entre novamente.");
  return data.user.id;
}
