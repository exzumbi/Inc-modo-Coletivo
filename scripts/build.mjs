/** Dependency-free static build. Only site/ assets are published; no backend. */
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  rm,
  copyFile,
  lstat,
} from "node:fs/promises";
import { resolve, relative, join, dirname, extname } from "node:path";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, ".."),
  source = join(root, "site"),
  out = join(root, "public");
const checkOnly = process.argv.includes("--check-only");
const permitted = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".txt",
]);
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    const stat = await lstat(p);
    assert(!stat.isSymbolicLink(), "Symlink not allowed: " + e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}
const files = await walk(source);
const names = new Set(
  files.map((p) => relative(source, p).replaceAll("\\", "/")),
);
assert(
  names.has("index.html") && names.has("404.html"),
  "Home and real 404 required",
);
for (const name of names) {
  assert(permitted.has(extname(name)), "Unapproved published type: " + name);
  assert(
    !/(^|\/)(\.data|\.git|admin|backstage|api|functions|_worker\.js)(\/|$)/.test(
      name,
    ),
    "Private/server route: " + name,
  );
}
const pages = [];
let links = 0,
  images = 0,
  whatsapp = 0;
for (const file of files) {
  const name = relative(source, file).replaceAll("\\", "/");
  if (![".html", ".css", ".js", ".mjs"].includes(extname(name))) continue;
  const text = await readFile(file, "utf8");
  assert(
    !text.includes("/Inc-modo-Coletivo/"),
    "GitHub Pages prefix remains: " + name,
  );
  assert(
    !text.includes("http://localhost") && !text.includes("http://127.0.0.1"),
    "Local URL remains: " + name,
  );
  assert(
    !/\b(?:sk_live_|ghp_|github_pat_|-----BEGIN (?:RSA |EC )?PRIVATE KEY)/.test(
      text,
    ),
    "Potential secret in " + name,
  );
  if (name.endsWith(".html")) {
    assert(!/<form\b/i.test(text), "Forms are not operational in this release");
    assert(
      !/__next_f|\/_next\/|\/api\/|href=["']\/backstage/.test(text),
      "Backend payload in " + name,
    );
    assert(/<html[^>]+lang="pt-BR"/.test(text), "Missing language " + name);
    for (const match of text.matchAll(/\b(?:href|src)="([^"<>]+)"/g)) {
      const raw = match[1].replaceAll("&amp;", "&");
      if (
        !raw ||
        raw.startsWith("#") ||
        raw.startsWith("data:") ||
        raw.startsWith("__SITE_ORIGIN__")
      )
        continue;
      if (raw.startsWith("mailto:")) {
        assert(raw === "mailto:lojaincomodo@gmail.com", "Wrong email");
        continue;
      }
      const u = new URL(raw, "https://static.invalid/" + name);
      if (u.hostname === "wa.me") {
        assert(
          u.protocol === "https:" && u.pathname === "/5512991937635",
          "Wrong WhatsApp",
        );
        whatsapp++;
        continue;
      }
      if (u.origin !== "https://static.invalid") continue;
      const p = decodeURIComponent(u.pathname).replace(/^\//, "");
      const target = !p ? "index.html" : p.endsWith("/") ? p + "index.html" : p;
      assert(
        names.has(target) || names.has(p + "/index.html"),
        "Broken local asset/link: " + name + " -> " + raw,
      );
      if (/\.(png|jpg|jpeg|webp|svg|ico)$/.test(p)) images++;
      else links++;
    }
    const route =
      name === "index.html" ? "/" : "/" + name.replace(/index\.html$/, "");
    pages.push({
      route,
      noindex: /name="robots" content="noindex/.test(text),
      name,
    });
  }
}
const aliases = JSON.parse(
  await readFile(join(root, "redirects.json"), "utf8"),
);
for (const [from, to] of Object.entries(aliases)) {
  assert(
    from !== to && !pages.some((p) => p.route === from),
    "Redirect shadows page",
  );
  assert(
    pages.some((p) => p.route === to),
    "Broken redirect " + to,
  );
}
let origin = "";
if (process.env.SITE_URL || process.env.CF_PAGES_URL) {
  const custom = Boolean(process.env.SITE_URL);
  const u = new URL(process.env.SITE_URL || process.env.CF_PAGES_URL);
  assert(
    u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash,
    "SITE_URL must be an HTTPS origin",
  );
  if (!custom && u.hostname.endsWith(".pages.dev"))
    u.hostname = u.hostname.split(".").slice(-3).join(".");
  origin = u.origin;
}
if (!checkOnly) {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const file of files) {
    const name = relative(source, file),
      dest = join(out, name);
    await mkdir(dirname(dest), { recursive: true });
    if (name.endsWith(".html")) {
      let html = (await readFile(file, "utf8")).replaceAll(
        "__SITE_ORIGIN__",
        origin,
      );
      // Local builds have no guessed public origin. Pages provides CF_PAGES_URL.
      if (!origin) html = html.replace(/<link rel="canonical"[^>]*>/g, "");
      await writeFile(dest, html);
    } else await copyFile(file, dest);
  }
  const xmlEscape = (s) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  const urls = pages
    .filter((p) => p.route !== "/404.html" && !p.noindex)
    .map((p) => "<url><loc>" + xmlEscape(origin + p.route) + "</loc></url>")
    .join("");
  if (origin)
    await writeFile(
      join(out, "sitemap.xml"),
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        urls +
        "</urlset>",
    );
  await writeFile(
    join(out, "robots.txt"),
    "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /backstage\nDisallow: /api/\n" +
      (origin ? "Sitemap: " + origin + "/sitemap.xml\n" : ""),
  );
  await writeFile(
    join(out, "_redirects"),
    Object.entries(aliases)
      .map(([from, to]) => from + " " + to + " 301")
      .join("\n") + "\n",
  );
  await writeFile(
    join(out, "_headers"),
    `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cache-Control: public, max-age=0, must-revalidate
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
`,
  );
  await writeFile(
    join(out, "release.json"),
    JSON.stringify(
      {
        version: "1.0.0",
        commit: process.env.CF_PAGES_COMMIT_SHA || null,
        branch: process.env.CF_PAGES_BRANCH || "producao-cloudflare-pages",
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify(
    {
      checkOnly,
      pages: pages.length - 1,
      localLinks: links,
      imageReferences: images,
      whatsappLinks: whatsapp,
      legacyRedirects: Object.keys(aliases).length,
      origin: origin || "not set (local build)",
      output: checkOnly ? null : "public",
      backend: false,
    },
    null,
    2,
  ),
);
