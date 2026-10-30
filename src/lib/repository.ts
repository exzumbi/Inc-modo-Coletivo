import { client, ownerId } from "./client";
import { modules, validate, type Item } from "./schema";
export type Entry = {
  owner_id?: string;
  id: string;
  kind: string;
  data: Item;
  updated_at: string;
};
const bucket = "backstage-private";
export async function list(kind: string): Promise<Item[]> {
  if (!modules[kind]) throw Error("Área inválida.");
  const owner = await ownerId();
  const rows: Entry[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client()
      .from("backstage_entries")
      .select("*")
      .eq("owner_id", owner)
      .eq("kind", kind)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw Error(
        "Não foi possível carregar os registros. Verifique a conexão e as permissões.",
      );
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows.map((r) => ({ ...r.data, id: r.id, updated: r.updated_at }));
}
export async function save(kind: string, item: Item) {
  const module = modules[kind];
  if (!module) throw Error("Área inválida.");
  const owner = await ownerId();
  const { id, updated, ...values } = item;
  const valid = validate(module.fields, values);
  let data: Item = { ...values, ...valid };
  if (id) {
    if (!updated) throw Error("Reabra o registro para editar a versão atual.");
    // Keep fields not shown in the simplified editor without losing legacy data.
    const { data: current, error: readError } = await client()
      .from("backstage_entries")
      .select("data")
      .eq("owner_id", owner)
      .eq("id", id)
      .eq("kind", kind)
      .single();
    if (readError) throw Error("Registro não encontrado.");
    data = { ...current.data, ...data };
    const result = await client()
      .from("backstage_entries")
      .update({ data })
      .eq("owner_id", owner)
      .eq("id", id)
      .eq("kind", kind)
      .eq("updated_at", updated)
      .select("id")
      .maybeSingle();
    if (result.error)
      throw Error(
        "Não foi possível salvar. Nenhuma confirmação de salvamento foi recebida.",
      );
    if (!result.data)
      throw Error(
        "Este registro mudou em outro dispositivo. Copie seu texto e reabra a versão atual antes de salvar.",
      );
    return id;
  }
  const newId = crypto.randomUUID();
  const { error } = await client()
    .from("backstage_entries")
    .insert({ owner_id: owner, id: newId, kind, data });
  if (error)
    throw Error(
      "Não foi possível salvar. Confira sua conexão e tente novamente.",
    );
  return newId;
}
export async function remove(kind: string, id: string) {
  const owner = await ownerId();
  const { data, error } = await client()
    .from("backstage_entries")
    .delete()
    .eq("owner_id", owner)
    .eq("kind", kind)
    .eq("id", id)
    .select("id");
  if (error || data?.length !== 1)
    throw Error(
      "Não foi possível excluir. Atualize a lista e tente novamente.",
    );
}
export const sha256 = async (bytes: ArrayBuffer) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
function mimeOf(b: Uint8Array) {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v))
    return "image/png";
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  const s = new TextDecoder().decode(b.slice(0, 12));
  if (s.startsWith("RIFF") && s.slice(8) === "WEBP") return "image/webp";
  if (s.startsWith("%PDF-")) return "application/pdf";
  throw Error("Formatos aceitos: PNG, JPEG, WebP e PDF.");
}
export async function upload(
  file: File,
  id = crypto.randomUUID().replaceAll("-", "").slice(0, 24),
) {
  if (!file.size || file.size > 10485760)
    throw Error("Escolha um arquivo de até 10 MB.");
  const owner = await ownerId();
  const bytes = await file.arrayBuffer(),
    mime = mimeOf(new Uint8Array(bytes));
  const digest = await sha256(bytes);
  const path = owner + "/" + id;
  const { error } = await client()
    .storage.from(bucket)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw Error("Não foi possível guardar o anexo privado.");
  const metadata = {
    owner_id: owner,
    id,
    name: file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 150),
    mime,
    size: file.size,
    sha256: digest,
  };
  const result = await client().from("backstage_files").insert(metadata);
  if (result.error) {
    await client().storage.from(bucket).remove([path]);
    throw Error("Não foi possível registrar o arquivo. Repita o envio.");
  }
  return {
    url: "/api/files/" + id,
    name: metadata.name,
    image: mime.startsWith("image/"),
  };
}
export async function downloadAttachment(id: string) {
  const owner = await ownerId();
  const { data: meta, error } = await client()
    .from("backstage_files")
    .select("*")
    .eq("owner_id", owner)
    .eq("id", id)
    .single();
  if (error) throw Error("Anexo não encontrado ou não autorizado.");
  const result = await client()
    .storage.from(bucket)
    .download(owner + "/" + id);
  if (result.error) throw Error("Não foi possível baixar o arquivo.");
  const bytes = await result.data.arrayBuffer();
  if ((await sha256(bytes)) !== meta.sha256)
    throw Error("A integridade do anexo não pôde ser confirmada.");
  download(new Blob([bytes], { type: meta.mime }), meta.name);
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Compatibility adapter for the original Manager. No local /api server is used.
export async function backstageRequest(
  path: string,
  options: RequestInit = {},
) {
  try {
    if (path === "/api/files" && options.body instanceof FormData)
      return Response.json(await upload(options.body.get("file") as File));
    if (path === "/api/admin/actions") {
      const { action, id } = JSON.parse(String(options.body));
      if (action === "schedule-idea") {
        const { data, error } = await client().rpc("backstage_schedule", {
          idea_id: id,
        });
        if (error)
          throw Error(
            "Não foi possível criar o planejamento. Tente atualizar a lista.",
          );
        return Response.json(data);
      }
      if (action === "duplicate-calendar") {
        const source = (await list("calendar")).find((x) => x.id === id);
        if (!source) throw Error("Conteúdo não encontrado.");
        const { id: _, updated: __, sourceIdea: ___, ...copy } = source;
        const target = await save("calendar", {
          ...copy,
          title: String(source.title).slice(0, 990) + " (cópia)",
          status: "Ideia",
          date: "",
          approved: false,
        });
        return Response.json({ id: target });
      }
      throw Error("Ação inválida.");
    }
    const url = new URL(path, "https://backstage.invalid"),
      kind = url.pathname.split("/").pop()!;
    if (!modules[kind]) throw Error("Área inválida.");
    if (options.method === "POST")
      return Response.json({
        id: await save(kind, JSON.parse(String(options.body))),
      });
    if (options.method === "DELETE") {
      await remove(kind, url.searchParams.get("id")!);
      return Response.json({ ok: true });
    }
    return Response.json(await list(kind));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Não foi possível concluir." },
      { status: 400 },
    );
  }
}
export async function snapshot() {
  await ownerId();
  const { data, error } = await client().rpc("backstage_snapshot");
  if (error)
    throw Error("Não foi possível ler o backup. Verifique as permissões.");
  return data as { records: Entry[]; files: FileMetadata[] };
}
export type FileMetadata = {
  owner_id?: string;
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
};
export async function exportBackup() {
  const initial = await snapshot();
  const files = [];
  for (const meta of initial.files) {
    const owner = await ownerId();
    const result = await client()
      .storage.from(bucket)
      .download(owner + "/" + meta.id);
    if (result.error)
      throw Error(
        "Falha no backup de um anexo. Nenhum backup completo foi gerado.",
      );
    const bytes = await result.data.arrayBuffer();
    if ((await sha256(bytes)) !== meta.sha256)
      throw Error("Anexo com conteúdo divergente.");
    let binary = "";
    for (const x of new Uint8Array(bytes)) binary += String.fromCharCode(x);
    const { owner_id: _, ...safe } = meta;
    files.push({ ...safe, base64: btoa(binary) });
  }
  const final = await snapshot();
  if (JSON.stringify(final) !== JSON.stringify(initial))
    throw Error(
      "Os dados mudaram durante o backup. Feche outros editores e tente novamente.",
    );
  const records = initial.records.map(({ owner_id: _, ...r }) => r);
  const payload = {
    format: "incomodo-backstage",
    version: 1,
    exportedAt: new Date().toISOString(),
    records,
    files,
  };
  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    "meu-backstage-backup-" + new Date().toISOString().slice(0, 10) + ".json",
  );
  return records.length;
}
export async function importBackup(file: File) {
  if (file.size > 50 * 1024 * 1024)
    throw Error("Pacote maior que 50 MB; precisa de importação assistida.");
  const bundle = JSON.parse(await file.text());
  if (
    bundle.format !== "incomodo-backstage" ||
    bundle.version !== 1 ||
    !Array.isArray(bundle.records) ||
    !Array.isArray(bundle.files)
  )
    throw Error("Formato de backup não reconhecido.");
  const ids = new Set();
  for (const r of bundle.records) {
    if (
      !modules[r.kind] ||
      typeof r.id !== "string" ||
      !/^([a-f0-9]{24}|[a-f0-9-]{36})$/.test(r.id) ||
      ids.has(r.id) ||
      !r.data ||
      Array.isArray(r.data) ||
      typeof r.data !== "object"
    )
      throw Error("Registro inválido ou duplicado no pacote.");
    ids.add(r.id);
  }
  // Refuse conflicts before uploading files. SQL repeats the check atomically.
  const existing = await snapshot();
  for (const r of bundle.records) {
    const old = existing.records.find((x) => x.id === r.id);
    if (
      old &&
      (old.kind !== r.kind ||
        JSON.stringify(sortObject(old.data)) !==
          JSON.stringify(sortObject(r.data)))
    )
      throw Error(
        "Existe um registro diferente com o mesmo ID. Nenhum conteúdo foi sobrescrito.",
      );
  }
  const newFiles: string[] = [];
  try {
    for (const f of bundle.files) {
      if (!/^[a-f0-9]{24}$/.test(f.id) || typeof f.base64 !== "string")
        throw Error("Anexo inválido.");
      const bytes = Uint8Array.from(atob(f.base64), (c: string) =>
        c.charCodeAt(0),
      );
      if (
        (await sha256(bytes.buffer)) !== f.sha256 ||
        bytes.byteLength !== f.size
      )
        throw Error("Hash ou tamanho do anexo incorreto.");
      const old = existing.files.find((x) => x.id === f.id);
      if (old) {
        if (old.sha256 !== f.sha256) throw Error("Anexo existente diferente.");
        continue;
      }
      await upload(new File([bytes], f.name, { type: f.mime }), f.id);
      newFiles.push(f.id);
    }
    const { data, error } = await client().rpc("backstage_import", {
      records: bundle.records.map((r: Entry) => ({
        id: r.id,
        kind: r.kind,
        data: r.data,
        updated_at: r.updated_at,
      })),
    });
    if (error)
      throw Error("Importação recusada. Os registros não foram alterados.");
    return data as { imported: number; skipped: number };
  } catch (e) {
    const owner = await ownerId();
    for (const id of newFiles) {
      await client()
        .storage.from(bucket)
        .remove([owner + "/" + id]);
      await client()
        .from("backstage_files")
        .delete()
        .eq("owner_id", owner)
        .eq("id", id);
    }
    throw e;
  }
}
function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortObject(v)]),
    );
  return value;
}
