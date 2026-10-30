import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { loadEnv } from "vite";
const env = {
  ...loadEnv("production", process.cwd(), "VITE_"),
  ...process.env,
};
const url = env.VITE_SUPABASE_URL,
  key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert(
  url && key,
  "Conecte VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY antes de publicar. Não há modo de login fictício.",
);
const u = new URL(url);
assert(
  u.protocol === "https:" &&
    /^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) &&
    u.pathname === "/" &&
    !u.username &&
    !u.password,
  "URL pública Supabase inválida.",
);
assert(!key.startsWith("sb_secret_"), "Chave secreta proibida no frontend.");
if (!key.startsWith("sb_publishable_")) {
  let role;
  try {
    role = JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role;
  } catch {}
  assert(
    role === "anon",
    "Use somente a publishable key ou a chave anon, nunca service_role.",
  );
}
for (const cmd of [
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  ["node_modules/vite/bin/vite.js", "build"],
]) {
  const r = spawnSync(process.execPath, cmd, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
await mkdir("dist", { recursive: true });
await writeFile(
  "dist/_headers",
  `/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Cache-Control: no-store
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${u.origin}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
`,
);
await writeFile("dist/robots.txt", "User-agent: *\nDisallow: /\n");
const html = await readFile("dist/index.html", "utf8");
assert(!html.includes("service_role"), "Chave privada no resultado de build.");
