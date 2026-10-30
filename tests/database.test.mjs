import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
async function database() {
  const db = new PGlite();
  await db.exec(
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${owner}'); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`,
  );
  await db.exec(
    await readFile(new URL("../supabase/setup.sql", import.meta.url), "utf8"),
  );
  return db;
}
async function login(db, uid = owner) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec("SET ROLE authenticated");
}
const item = (id = "aaaaaaaaaaaaaaaaaaaaaaaa") => ({
  id,
  kind: "ideas",
  data: { title: "Pauta", sources: "Fonte preservada", extra: "campo legado" },
  updated_at: "2025-01-02T00:00:00Z",
});
test("SQL/RLS: only owner can read/write; browser cannot grant ownership", async () => {
  const db = await database();
  try {
    await login(db);
    await db.query("SELECT public.backstage_import($1::jsonb)", [
      JSON.stringify([item()]),
    ]);
    assert.equal(
      (await db.query("SELECT * FROM public.backstage_entries")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("INSERT INTO public.backstage_owners VALUES($1)", [other]),
    );
    await assert.rejects(
      db.query("UPDATE public.backstage_entries SET owner_id=$1", [other]),
    );
    await db.exec("RESET ROLE");
    await db.query("INSERT INTO auth.users VALUES($1)", [other]);
    await login(db, other);
    assert.equal(
      (await db.query("SELECT * FROM public.backstage_entries")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO public.backstage_entries(id,kind,data) VALUES('bbbbbbbbbbbbbbbbbbbbbbbb','ideas','{}')",
      ),
    );
    await assert.rejects(
      db.query("SELECT public.backstage_import($1::jsonb)", [
        JSON.stringify([item()]),
      ]),
    );
    await db.exec("RESET ROLE; SET ROLE anon");
    await assert.rejects(db.query("SELECT * FROM public.backstage_entries"));
    await assert.rejects(db.query("SELECT public.backstage_snapshot()"));
  } finally {
    await db.close();
  }
});
test("import is idempotent, preserves payload/date and rolls back conflicts", async () => {
  const db = await database();
  try {
    await login(db);
    const rows = [item()];
    let r = await db.query(
      "SELECT public.backstage_import($1::jsonb) AS result",
      [JSON.stringify(rows)],
    );
    assert.equal(r.rows[0].result.imported, 1);
    r = await db.query("SELECT public.backstage_import($1::jsonb) AS result", [
      JSON.stringify(rows),
    ]);
    assert.equal(r.rows[0].result.skipped, 1);
    const saved = (await db.query("SELECT * FROM public.backstage_entries"))
      .rows[0];
    assert.equal(saved.data.extra, "campo legado");
    assert.equal(
      new Date(saved.updated_at).toISOString(),
      "2025-01-02T00:00:00.000Z",
    );
    await assert.rejects(
      db.query("SELECT public.backstage_import($1::jsonb)", [
        JSON.stringify([
          item("cccccccccccccccccccccccc"),
          { ...item(), data: { title: "Conflito" } },
        ]),
      ]),
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM public.backstage_entries",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("idea conversion is private, idempotent and keeps sources", async () => {
  const db = await database();
  try {
    await login(db);
    await db.query("SELECT public.backstage_import($1::jsonb)", [
      JSON.stringify([item()]),
    ]);
    const a = (
      await db.query("SELECT public.backstage_schedule($1) AS result", [
        item().id,
      ])
    ).rows[0].result;
    const b = (
      await db.query("SELECT public.backstage_schedule($1) AS result", [
        item().id,
      ])
    ).rows[0].result;
    assert.equal(a.id, b.id);
    assert.equal(a.created, true);
    assert.equal(b.created, false);
    const saved = (
      await db.query(
        "SELECT data FROM public.backstage_entries WHERE kind='calendar'",
      )
    ).rows[0].data;
    assert.equal(saved.references, "Fonte preservada");
    assert.equal(saved.date, "");
  } finally {
    await db.close();
  }
});
test("all creative kinds support persistence and deletion, with timestamps", async () => {
  const db = await database();
  try {
    await login(db);
    for (const [i, kind] of [
      "ideas",
      "calendar",
      "planning",
      "articles",
      "projects",
      "tasks",
      "lab",
      "studies",
      "career",
      "notes",
      "goals",
      "ecosystem",
      "results",
    ].entries()) {
      const id = String(i).padStart(24, "0");
      await db.query(
        "INSERT INTO public.backstage_entries(id,kind,data) VALUES($1,$2,$3)",
        [id, kind, JSON.stringify({ title: kind })],
      );
      await db.query(
        "UPDATE public.backstage_entries SET data=jsonb_set(data,'{title}','\"Editado\"') WHERE id=$1",
        [id],
      );
      assert.equal(
        (
          await db.query(
            "SELECT data FROM public.backstage_entries WHERE id=$1",
            [id],
          )
        ).rows[0].data.title,
        "Editado",
      );
      await db.query("DELETE FROM public.backstage_entries WHERE id=$1", [id]);
    }
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM public.backstage_entries",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("snapshot import preserves all fields and IDs (private SQLite copy when supplied)", async () => {
  const bundle = process.env.BACKSTAGE_MIGRATION_COPY
    ? JSON.parse(await readFile(process.env.BACKSTAGE_MIGRATION_COPY, "utf8"))
    : {
        records: Array.from({ length: 16 }, (_, i) => ({
          id: String(i).padStart(24, "0"),
          kind: i < 10 ? "ideas" : "studies",
          data: {
            title: "Fixture " + i,
            originalField: "Preservado",
            sources: "https://example.org/fonte",
          },
          updated_at: "2025-01-01T00:00:00Z",
        })),
        files: [],
      };
  assert.equal(bundle.records.filter((x) => x.kind === "ideas").length, 10);
  assert.equal(bundle.records.filter((x) => x.kind === "studies").length, 6);
  const db = await database();
  try {
    await login(db);
    await db.query("SELECT public.backstage_import($1::jsonb)", [
      JSON.stringify(bundle.records),
    ]);
    const snapshot = (
      await db.query("SELECT public.backstage_snapshot() AS value")
    ).rows[0].value;
    assert.equal(snapshot.records.length, bundle.records.length);
    const sorted = (v) => {
      if (Array.isArray(v)) return v.map(sorted);
      if (v && typeof v === "object")
        return Object.fromEntries(
          Object.entries(v)
            .sort()
            .map(([k, x]) => [k, sorted(x)]),
        );
      return v;
    };
    for (const original of bundle.records) {
      const migrated = snapshot.records.find((x) => x.id === original.id);
      assert(
        migrated && migrated.kind === original.kind,
        "Legacy ID/kind lost",
      );
      assert(
        JSON.stringify(sorted(migrated.data)) ===
          JSON.stringify(sorted(original.data)),
        "Legacy fields changed",
      );
      assert.equal(
        new Date(migrated.updated_at).toISOString(),
        new Date(original.updated_at).toISOString(),
      );
    }
    await db.query("SELECT public.backstage_import($1::jsonb)", [
      JSON.stringify(bundle.records),
    ]);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM public.backstage_entries",
        )
      ).rows[0].n,
      bundle.records.length,
    );
  } finally {
    await db.close();
  }
});
