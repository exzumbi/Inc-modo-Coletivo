import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
test("production build refuses missing or privileged Supabase credentials", () => {
  for (const key of [
    "",
    "sb_secret_test_not_a_real_key",
    "e30." +
      Buffer.from(JSON.stringify({ role: "service_role" })).toString(
        "base64url",
      ) +
      ".test",
  ]) {
    const r = spawnSync(process.execPath, ["scripts/build.mjs"], {
      env: {
        ...process.env,
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: key,
      },
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert(
      !r.stdout.includes("building client"),
      "Rejected configuration reached bundler",
    );
  }
});
test("Worker is isolated from the public site and has no paid service bindings", async () => {
  const cfg = JSON.parse(
    (
      await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
    ).replace(/,\s*([}\]])/g, "$1"),
  );
  assert.equal(cfg.name, "meu-backstage-incomodo");
  assert.notEqual(cfg.name, "inc-modo-coletivo");
  assert.equal(cfg.assets.directory, "./dist");
  for (const key of [
    "main",
    "r2_buckets",
    "d1_databases",
    "durable_objects",
    "queues",
  ])
    assert.equal(cfg[key], undefined);
});
