// Browser integration tests use a simulated Supabase HTTP service. Real RLS SQL
// is tested separately with PostgreSQL/PGlite; this does not prove online login.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const out =
  process.env.BACKSTAGE_TEST_ARTIFACTS || "/tmp/backstage-browser-tests";
const port = 5180,
  base = "http://127.0.0.1:" + port;
const app = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { stdio: "ignore" },
);
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {}),
  args: ["--no-sandbox"],
});
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
let tick = 0,
  failWrite = false;
const rows = new Map(),
  files = new Map(),
  objects = new Map();
const now = () => new Date(Date.now() + ++tick * 1000).toISOString();
const user = (id) => ({
  id,
  email: id === owner ? "owner@example.test" : "other@example.test",
  aud: "authenticated",
  role: "authenticated",
  created_at: "2025-01-01T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
});
const token = (id) =>
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ) +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: id,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url") +
  ".test-signature";
async function mock(context) {
  await context.route("https://example.supabase.co/**", async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      path = u.pathname,
      method = req.method();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };
    const reply = (data, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/auth/v1/token") {
      const body = req.postDataJSON();
      if (body.password !== "test-password-123")
        return reply(
          {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          },
          400,
        );
      const id = body.email === "other@example.test" ? other : owner;
      return reply({
        access_token: token(id),
        refresh_token: "test-refresh-" + id,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: user(id),
      });
    }
    const auth = req.headers().authorization || "";
    let uid;
    try {
      uid = JSON.parse(
        Buffer.from(auth.split(".")[1], "base64url").toString(),
      ).sub;
    } catch {}
    if (path === "/auth/v1/user")
      return uid ? reply(user(uid)) : reply({ message: "Unauthorized" }, 401);
    if (path === "/auth/v1/logout")
      return route.fulfill({ status: 204, headers });
    if (path === "/rest/v1/backstage_owners")
      return reply(uid === owner ? [{ user_id: owner }] : []);
    if (uid !== owner) return reply({ message: "Not authorized" }, 403);
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").pop(),
        body = req.postDataJSON();
      if (name === "backstage_snapshot")
        return reply({
          records: [...rows.values()].sort((a, b) => a.id.localeCompare(b.id)),
          files: [...files.values()].sort((a, b) => a.id.localeCompare(b.id)),
        });
      if (name === "backstage_import") {
        for (const r of body.records) rows.set(r.id, { ...r, owner_id: owner });
        return reply({ imported: body.records.length, skipped: 0 });
      }
      if (name === "backstage_schedule") {
        const source = rows.get(body.idea_id),
          id = "33333333-3333-4333-8333-333333333333";
        if (!rows.has(id))
          rows.set(id, {
            owner_id: owner,
            id,
            kind: "calendar",
            data: {
              title: source.data.title,
              references: source.data.sources || "",
              date: "",
              status: "Ideia",
              sourceIdea: source.id,
            },
            updated_at: now(),
          });
        return reply({ id, created: true });
      }
    }
    if (path.startsWith("/rest/v1/backstage_")) {
      const table = path.split("/").pop(),
        store = table === "backstage_files" ? files : rows;
      const filter = (entry) =>
        [...u.searchParams].every(
          ([k, v]) => !v.startsWith("eq.") || String(entry[k]) === v.slice(3),
        );
      if (method === "GET") {
        let result = [...store.values()].filter(filter);
        const single = req.headers().accept?.includes("vnd.pgrst.object");
        return reply(single ? result[0] || null : result);
      }
      if (method === "POST") {
        if (failWrite)
          return reply({ message: "Simulated network failure" }, 503);
        const data = req.postDataJSON();
        for (const item of Array.isArray(data) ? data : [data])
          store.set(item.id, {
            ...item,
            ...(table === "backstage_entries" ? { updated_at: now() } : {}),
          });
        return reply(null, 201);
      }
      if (method === "PATCH") {
        const found = [...store.values()].filter(filter),
          data = req.postDataJSON();
        for (const item of found)
          store.set(item.id, { ...item, ...data, updated_at: now() });
        return reply(found.map((x) => ({ id: x.id })));
      }
      if (method === "DELETE") {
        const found = [...store.values()].filter(filter);
        for (const item of found) store.delete(item.id);
        return reply(found.map((x) => ({ id: x.id })));
      }
    }
    if (path.startsWith("/storage/v1/object")) {
      if (method === "POST") {
        const id = path.split("/").pop();
        objects.set(id, req.postDataBuffer());
        return reply({ Key: path, Id: id });
      }
      if (method === "GET") {
        const id = path.split("/").pop();
        return route.fulfill({
          status: 200,
          headers,
          contentType: "image/png",
          body: objects.get(id),
        });
      }
      if (method === "DELETE") return reply([]);
    }
    return reply({ message: "Unhandled test route " + path }, 404);
  });
}
async function login(page, email = "owner@example.test") {
  await page.goto(base);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Entrar no Meu Backstage" }).click();
}
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await mock(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  assert.equal(
    await page.getByText("Acesso privado. Não há cadastro público.").count(),
    1,
  );
  assert.equal(await page.getByText("Criar conta", { exact: true }).count(), 0);
  await login(page);
  await page
    .getByRole("navigation", { name: "Organização criativa" })
    .waitFor();
  assert.equal(await page.locator(".admin-sidebar nav a").count(), 6);
  // Exercise actual reused forms, repository calls and fresh-page persistence.
  for (const kind of [
    "ideas",
    "calendar",
    "articles",
    "projects",
    "tasks",
    "studies",
    "results",
  ]) {
    await page.goto(base + "/#/" + kind);
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByLabel("Título", { exact: true }).fill("Teste " + kind);
    await page
      .getByRole("button", { name: "Salvar registro", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page
      .getByRole("button")
      .filter({ hasText: "Teste " + kind })
      .first()
      .waitFor();
  }
  await page.goto(base + "/#/ideas");
  await page.getByRole("button").filter({ hasText: "Teste ideas" }).click();
  await page
    .getByLabel("Resumo", { exact: true })
    .fill("Uma referência editorial segura");
  await page
    .getByLabel("Fontes a pesquisar", { exact: true })
    .fill("https://example.org/fonte");
  await page
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.reload();
  await page.getByRole("button").filter({ hasText: "Teste ideas" }).waitFor();
  await page.getByLabel("Buscar registros").fill("nenhumresultado");
  assert.equal(await page.locator(".item-row").count(), 0);
  await page.getByLabel("Buscar registros").fill("");
  await page.getByRole("button").filter({ hasText: "Teste ideas" }).click();
  await page.getByRole("button", { name: "Transformar em publicação" }).click();
  await page.waitForURL(/calendar\?editar=/);
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page
      .getByLabel("Referências e links de arquivos", { exact: true })
      .inputValue(),
    "https://example.org/fonte",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  // Network error cannot be shown as saved and keeps text in the form.
  await page.goto(base + "/#/ideas");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Texto não perdido");
  failWrite = true;
  await page
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("alert")
    .filter({ hasText: "Não foi possível salvar" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Título", { exact: true }).inputValue(),
    "Texto não perdido",
  );
  failWrite = false;
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  const second = await browser.newContext();
  await mock(second);
  const p2 = await second.newPage();
  await login(p2);
  await p2.getByRole("button").filter({ hasText: "Teste ideas" }).waitFor();
  await second.close();
  await page.goto(base + "/#/ideas");
  await page.getByRole("button").filter({ hasText: "Teste ideas" }).click();
  await page
    .getByLabel("Resumo", { exact: true })
    .fill("Texto local preservado");
  const remote = [...rows.values()].find((r) => r.kind === "ideas");
  rows.set(remote.id, {
    ...remote,
    data: { ...remote.data, summary: "Alterado em outro dispositivo" },
    updated_at: now(),
  });
  await page
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("alert")
    .filter({ hasText: "outro dispositivo" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Resumo", { exact: true }).inputValue(),
    "Texto local preservado",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  // Private attachment upload/download, included in the complete backup.
  await page.goto(base + "/#/projects");
  await page.getByRole("button").filter({ hasText: "Teste projects" }).click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFOkAAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByRole("dialog").locator("input[type=file]").setInputFiles({
    name: "capa-teste.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("dialog").locator(".attachment-link").waitFor();
  const [attachment] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("dialog").locator(".attachment-link").click(),
  ]);
  assert.equal(attachment.suggestedFilename(), "capa-teste.png");
  await page
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.goto(base + "/#/ideas");
  // Full backup is a private download; import restores a copy without auth data.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exportar backup" }).click(),
  ]);
  const path = await download.path();
  const backup = JSON.parse(await readFile(path, "utf8"));
  assert(backup.records.length >= 7);
  assert.equal(backup.files.length, 1);
  assert(!JSON.stringify(backup).includes("access_token"));
  assert(!JSON.stringify(backup).includes("refresh_token"));
  rows.clear();
  files.clear();
  objects.clear();
  await page.reload();
  await page
    .locator('input[type=file][accept="application/json,.json"]')
    .setInputFiles({
      name: "copia.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await page.getByRole("button", { name: "Validar e importar cópia" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Importação concluída" })
    .waitFor();
  assert.equal(rows.size, backup.records.length);
  assert.equal(files.size, 1);
  assert.equal(objects.size, 1);
  await page
    .getByRole("button")
    .filter({ hasText: "Teste ideas" })
    .first()
    .click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    await page.getByRole("button").filter({ hasText: "Teste ideas" }).count(),
    0,
  );
  await mkdir(out, { recursive: true });
  await page.screenshot({ path: out + "/desktop.png", fullPage: true });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if (width === 390) {
      await page.getByRole("button", { name: "Abrir navegação" }).click();
      await page
        .getByRole("navigation", { name: "Organização criativa" })
        .getByRole("link", { name: "Estudos", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Adicionar", exact: true })
        .waitFor();
    }
    await page.screenshot({
      path: out + "/tela-" + width + ".png",
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await page.getByRole("button", { name: "Entrar no Meu Backstage" }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Entrar no Meu Backstage" }).waitFor();
  assert.deepEqual(errors, []);
  await context.close();
  const denied = await browser.newContext();
  await mock(denied);
  const pd = await denied.newPage();
  await login(pd, "other@example.test");
  await pd
    .getByRole("alert")
    .filter({ hasText: "não está autorizada" })
    .waitFor();
  assert.equal(await pd.locator(".admin-sidebar").count(), 0);
  await denied.close();
  await writeFile(
    out + "/browser-test.json",
    JSON.stringify(
      {
        provider: "simulated Supabase HTTP",
        areas: 6,
        forms: 7,
        loginUi: true,
        ownerDenialUi: true,
        crud: true,
        secondBrowserRead: true,
        backupAndRestore: true,
        privateAttachmentBackup: true,
        calendarConversion: true,
        search: true,
        mobile: true,
        logout: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: six-area UI, 7 reused forms, CRUD, second browser context, search, calendar conversion, backup/restore, save failure, mobile, logout and unauthorized account. Supabase HTTP simulated.",
  );
} finally {
  await browser.close();
  app.kill("SIGTERM");
}
