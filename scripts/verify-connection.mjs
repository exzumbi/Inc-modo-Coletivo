/** Read-only checks against the dedicated real project; no login or data import. */
import assert from 'node:assert/strict';
import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const url = new URL(env.VITE_SUPABASE_URL || 'https://invalid.invalid');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
assert(url.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password, 'Configure a URL pública do projeto dedicado.');
assert(key && !key.startsWith('sb_secret_'), 'Configure somente a chave pública.');
if (!key.startsWith('sb_publishable_')) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role; } catch {}
  assert(role === 'anon', 'Chave privilegiada recusada.');
}
assert(url.hostname !== 'example.supabase.co', 'Esta verificação exige o projeto real.');
const headers = { apikey: key };
if (!key.startsWith('sb_publishable_')) headers.Authorization = 'Bearer ' + key;
const settingsResponse = await fetch(new URL('/auth/v1/settings', url), { headers, signal: AbortSignal.timeout(20000) });
assert(settingsResponse.ok, 'Não foi possível verificar Auth no projeto real.');
const settings = await settingsResponse.json();
assert(settings.disable_signup === true, 'Desative Allow new users to sign up no Supabase antes de publicar.');
assert(settings.external?.email === true, 'Habilite o login por e-mail para a conta autorizada.');
for (const table of ['backstage_owners', 'backstage_entries', 'backstage_files']) {
  const response = await fetch(new URL('/rest/v1/' + table + '?select=*&limit=1', url), { headers, signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  assert([401,403].includes(response.status) && body.code === '42501', 'Verifique a instalação e o bloqueio anônimo da tabela ' + table + '.');
}
console.log(JSON.stringify({ authReachable: true, publicSignupDisabled: true, anonymousTablesBlocked: true, dataImported: false, ownerLoginTested: false, storageAndRestoreTested: false }, null, 2));
