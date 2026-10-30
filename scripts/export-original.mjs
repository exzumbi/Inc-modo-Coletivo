/** Read-only export of a validated COPY, never the original DB or credentials. */
import { DatabaseSync } from "node:sqlite";
import { resolve, dirname, join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { createHash } from "node:crypto";
const source = resolve(process.argv[2] || ""),
  output = resolve(process.argv[3] || "");
if (
  !process.argv[2] ||
  !process.argv[3] ||
  source === resolve("/workspace/Inc-modo-Coletivo/.data/incomodo.sqlite")
)
  throw Error("Informe uma cópia do banco e o destino privado.");
if (!output.startsWith("/workspace/private-backups/"))
  throw Error(
    "A cópia exportada deve ficar em /workspace/private-backups, nunca no GitHub.",
  );
const kinds = [
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
];
const db = new DatabaseSync(source, { readOnly: true });
try {
  if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
    throw Error("Banco inconsistente.");
  const rows = db
    .prepare("SELECT id,kind,data,updated FROM records ORDER BY id")
    .all()
    .filter((r) => kinds.includes(r.kind));
  const records = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    data: JSON.parse(r.data),
    updated_at: r.updated,
  }));
  const references = new Set();
  for (const r of records)
    for (const m of JSON.stringify(r.data).matchAll(
      /\/api\/files\/([a-f0-9]{24})/g,
    ))
      references.add(m[1]);
  const files = [];
  for (const id of references) {
    const f = db.prepare("SELECT * FROM files WHERE id=?").get(id);
    if (!f) throw Error("Anexo referenciado sem metadados.");
    const b = readFileSync(join(dirname(source), "uploads", id));
    files.push({
      id,
      name: f.name,
      mime: f.mime,
      size: b.length,
      sha256: createHash("sha256").update(b).digest("hex"),
      base64: b.toString("base64"),
    });
  }
  const bundle = {
    format: "incomodo-backstage",
    version: 1,
    exportedAt: new Date().toISOString(),
    records,
    files,
  };
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  writeFileSync(output, JSON.stringify(bundle, null, 2), { mode: 0o600 });
  chmodSync(output, 0o600);
  const counts = {};
  for (const r of records) counts[r.kind] = (counts[r.kind] || 0) + 1;
  console.log(
    JSON.stringify(
      {
        integrity: "ok",
        records: records.length,
        counts,
        files: files.length,
        sha256: createHash("sha256").update(readFileSync(output)).digest("hex"),
        originalChanged: false,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
