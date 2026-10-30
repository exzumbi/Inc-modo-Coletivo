import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "..");
const expectedTypes = {
  ".css": "text/css",
  ".js": "javascript",
  ".mjs": "javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}
test(
  "Worker serves the built site and assets with real MIME types",
  { timeout: 90000 },
  async (t) => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((r) => socket.close(r));
    const temporary = await mkdtemp(join(tmpdir(), "ic-worker-test-"));
    let logs = "";
    const child = spawn(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "dev",
        "--ip",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          XDG_CONFIG_HOME: join(temporary, "config"),
          WRANGLER_LOG_PATH: join(temporary, "wrangler.log"),
          WRANGLER_SEND_METRICS: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (x) => (logs = (logs + x).slice(-14000)));
    child.stderr.on("data", (x) => (logs = (logs + x).slice(-14000)));
    t.after(async () => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([
          once(child, "exit"),
          new Promise((r) =>
            setTimeout(() => {
              child.kill("SIGKILL");
              r();
            }, 3000).unref(),
          ),
        ]);
      }
      await rm(temporary, { recursive: true, force: true });
    });
    const base = "http://127.0.0.1:" + port;
    let ready = false;
    for (let i = 0; i < 250; i++) {
      if (child.exitCode !== null) throw Error("Wrangler stopped: " + logs);
      try {
        const r = await fetch(base + "/release.json");
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready, "Worker failed to start: " + logs);
    await t.test(
      "homepage references root assets and no GitHub Pages prefix",
      async () => {
        const r = await fetch(base + "/");
        assert.equal(r.status, 200);
        assert.match(r.headers.get("content-type"), /text\/html/);
        const html = await r.text();
        assert(html.includes('href="/assets/site.css"'));
        assert(!html.includes("/Inc-modo-Coletivo/"));
        assert(html.includes("data-vinyl-album"));
        assert(
          html.includes("https://inc-modo-coletivo.brunamara-mkt.workers.dev/"),
        );
      },
    );
    await t.test(
      "all CSS, JS, images and font files match build bytes and MIME",
      async () => {
        const files = await walk(join(root, "public/assets"));
        assert(files.length >= 7);
        for (const file of files) {
          const type = expectedTypes[extname(file)];
          assert(type, "Unknown asset type: " + file);
          const path = file
            .slice(join(root, "public").length)
            .replaceAll("\\", "/");
          const r = await fetch(base + path);
          assert.equal(r.status, 200, path);
          assert(
            r.headers.get("content-type")?.includes(type),
            path + " returned " + r.headers.get("content-type"),
          );
          assert.equal(
            hash(Buffer.from(await r.arrayBuffer())),
            hash(await readFile(file)),
            path,
          );
        }
      },
    );
    await t.test(
      "all pages load; missing assets and private routes stay 404",
      async () => {
        const files = await walk(join(root, "public"));
        for (const file of files.filter((p) => p.endsWith("index.html"))) {
          const path = file
            .slice(join(root, "public").length)
            .replaceAll("\\", "/")
            .replace(/index\.html$/, "");
          const r = await fetch(base + path);
          assert.equal(r.status, 200, path);
          assert.match(r.headers.get("content-type"), /text\/html/);
        }
        for (const path of [
          "/assets/missing.css",
          "/assets/missing.png",
          "/api/admin/leads",
          "/backstage/",
          "/admin/",
          "/.data/incomodo.sqlite",
        ]) {
          const r = await fetch(base + path);
          assert.equal(r.status, 404, path);
        }
      },
    );
    await t.test(
      "old prefixed asset URLs redirect to correct root file",
      async () => {
        for (const path of [
          "/assets/site.css",
          "/assets/site-interactions.mjs",
          "/assets/image-0.png",
        ]) {
          const r = await fetch(base + "/Inc-modo-Coletivo" + path, {
            redirect: "manual",
          });
          assert.equal(r.status, 301);
          assert.equal(new URL(r.headers.get("location"), base).pathname, path);
          const result = await fetch(base + "/Inc-modo-Coletivo" + path);
          assert.equal(result.status, 200);
          assert(
            result.headers
              .get("content-type")
              .includes(expectedTypes[extname(path)]),
          );
        }
      },
    );
    await t.test("security headers and metadata are present", async () => {
      const r = await fetch(base + "/");
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      assert(
        r.headers.get("content-security-policy").includes("script-src 'self'"),
      );
      const release = await (await fetch(base + "/release.json")).json();
      assert.equal(release.version, "1.0.1");
      assert(
        (await (await fetch(base + "/sitemap.xml")).text()).includes(
          "https://inc-modo-coletivo.brunamara-mkt.workers.dev/",
        ),
      );
    });
  },
);
