import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("private bucket blocks anonymous and non-owner even with broad existing policies", async () => {
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222",
    db = new PGlite();
  try {
    await db.exec(
      `CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${owner}'); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`,
    );
    await db.exec(
      await readFile(new URL("../supabase/setup.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      `CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit int,allowed_mime_types text[]); CREATE TABLE storage.objects(bucket_id text,name text,PRIMARY KEY(bucket_id,name)); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA storage TO anon,authenticated; GRANT ALL ON storage.objects TO anon,authenticated; CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:1] $$; CREATE POLICY broad_existing_policy ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true);`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/storage.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query(
          "SELECT public FROM storage.buckets WHERE id='backstage-private'",
        )
      ).rows[0].public,
      false,
    );
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await db.exec("SET ROLE authenticated");
    await db.query(
      "INSERT INTO storage.objects VALUES('backstage-private',$1)",
      [owner + "/private-file"],
    );
    assert.equal(
      (await db.query("SELECT * FROM storage.objects")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("INSERT INTO storage.objects VALUES('backstage-private',$1)", [
        other + "/forbidden",
      ]),
    );
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ]);
    await db.exec("SET ROLE authenticated");
    assert.equal(
      (await db.query("SELECT * FROM storage.objects")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("INSERT INTO storage.objects VALUES('backstage-private',$1)", [
        other + "/no-owner",
      ]),
    );
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query("SELECT * FROM storage.objects"));
  } finally {
    await db.close();
  }
});
