import { useEffect, useState } from "react";
import {
  backstageRequest as fetch,
  downloadAttachment,
} from "./lib/repository";
import { useRouter, useSearchParams } from "./navigation";
import {
  Plus,
  Search,
  X,
  Save,
  Trash2,
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  List,
  CalendarDays,
  Download,
  Upload,
  Copy,
  CalendarPlus,
} from "lucide-react";
import { modules, type Item, type Field } from "./lib/schema";
export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  if (field.type === "check")
    return (
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  return (
    <label className={field.type === "long" ? "field wide" : "field"}>
      {field.label}
      {field.required ? " *" : ""}
      {field.type === "long" ? (
        <textarea
          aria-label={field.label}
          rows={5}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          maxLength={40000}
        />
      ) : field.type === "select" ? (
        <select
          aria-label={field.label}
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecione</option>
          {field.options?.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      ) : (
        <input
          aria-label={field.label}
          type={
            field.type === "number"
              ? "number"
              : field.type === "date"
                ? "date"
                : field.type === "email"
                  ? "email"
                  : field.type === "url"
                    ? "url"
                    : "text"
          }
          min={field.type === "number" ? 0 : undefined}
          max={field.key === "progress" ? 100 : undefined}
          required={field.required}
          value={String(value || "")}
          maxLength={1000}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export function Manager({ kind, initial }: { kind: string; initial: Item[] }) {
  const mod = modules[kind];
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Item | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [view, setView] = useState("list");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [week, setWeek] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  });
  function fresh() {
    return Object.fromEntries(
      mod.fields
        .filter((f) => f.type === "check" || f.options)
        .map((f) => [f.key, f.type === "check" ? false : f.options?.[0] || ""]),
    ) as Item;
  }
  useEffect(() => {
    if (params.get("novo")) setEditing(fresh());
    const id = params.get("editar");
    if (id) setEditing(initial.find((x) => x.id === id) || null); // eslint-disable-next-line
  }, []);
  useEffect(() => {
    if (!editing) return;
    const prev = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      document.querySelector<HTMLDialogElement>("dialog")?.showModal();
      document
        .querySelector<HTMLInputElement>("dialog input:not([type=file])")
        ?.focus();
    }, 0);
    return () => {
      clearTimeout(timer);
      prev?.focus();
    };
  }, [!!editing]);
  function closeEditor() {
    setEditing(null);
    if (params.get("novo") || params.get("editar"))
      router.replace("/backstage/" + kind, { scroll: false });
  }
  const filtered = items.filter(
    (x) =>
      (!filter ||
        x.status === filter ||
        x.track === filter ||
        x.path === filter) &&
      JSON.stringify(x).toLowerCase().includes(query.toLowerCase()),
  );
  async function refresh() {
    const r = await fetch("/api/admin/" + kind);
    if (!r.ok)
      throw Error(
        "Não foi possível atualizar os dados. Confira sua conexão e tente novamente.",
      );
    setItems(await r.json());
    router.refresh();
  }
  async function persist(item: Item) {
    const r = await fetch("/api/admin/" + kind, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    const result = await r.json();
    if (!r.ok) throw Error(result.error || "Não foi possível salvar.");
    await refresh();
  }
  async function runAction(action: string) {
    if (!editing?.id) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: editing.id }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      await refresh();
      if (kind === "calendar") {
        const r = await fetch("/api/admin/calendar");
        const records: Item[] = await r.json();
        setItems(records);
        setEditing(records.find((x) => x.id === result.id) || null);
        setDeleting(false);
        setMessage(
          "Cópia criada como ideia, sem data. Revise antes de agendar.",
        );
      } else {
        closeEditor();
        router.push("/backstage/calendar?editar=" + result.id);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível concluir a ação.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function move(item: Item, status: string, date?: string) {
    setError("");
    try {
      await persist({ ...item, ...(date ? { date } : { status }) });
      setMessage(date ? "Data atualizada." : "Etapa atualizada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro.");
    }
  }
  const statuses = mod.fields.find((f) => f.key === "status")?.options || [];
  function open(item: Item) {
    setEditing({ ...item });
    setError("");
    setDeleting(false);
  }
  const row = (x: Item) => (
    <button className="item-row" key={String(x.id)} onClick={() => open(x)}>
      <div>
        <strong>{x.title}</strong>
        <small>
          {String(
            x.subtitle ||
              x.organization ||
              x.description ||
              x.summary ||
              x.track ||
              x.category ||
              "",
          ).slice(0, 160)}
        </small>
      </div>
      <div className="row-end">
        {x.date || x.deadline ? <time>{x.date || x.deadline}</time> : null}
        {x.progress !== undefined && <span>{x.progress}%</span>}
        {x.approved === true && (
          <span className="published-dot" title="Revisado internamente" />
        )}
        {x.status && <span className="pill">{x.status}</span>}
        <span>↗</span>
      </div>
    </button>
  );
  const kanbanCard = (x: Item) => (
    <div
      key={String(x.id)}
      className="kanban-card"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(x.id))}
    >
      <button onClick={() => open(x)}>
        <strong>{x.title}</strong>
        <small>{x.organization || x.channel || x.category || x.email}</small>
        {x.date && <small>{x.date}</small>}
      </button>
      <label className="sr-only" htmlFor={"move-" + x.id}>
        Mudar etapa de {x.title}
      </label>
      <select
        id={"move-" + x.id}
        aria-label={"Etapa de " + x.title}
        value={String(x.status || "")}
        onChange={(e) => move(x, e.target.value)}
      >
        {statuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </div>
  );
  function dateString(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const dayCell = (d: Date, muted = false) => {
    const date = dateString(d);
    return (
      <div
        key={date}
        className={
          "calendar-day " +
          (muted ? "muted " : "") +
          (date === dateString(new Date()) ? "today" : "")
        }
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const item = items.find(
            (x) => x.id === e.dataTransfer.getData("text/plain"),
          );
          if (item) void move(item, String(item.status), date);
        }}
      >
        <button
          className="day-number"
          aria-label={"Planejar conteúdo em " + date}
          onClick={() => open({ ...fresh(), date })}
        >
          {d.getDate()}
        </button>
        {filtered
          .filter((x) => x.date === date)
          .map((x) => (
            <button
              key={String(x.id)}
              className="calendar-event"
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", String(x.id))
              }
              onClick={() => open(x)}
            >
              {x.title}
            </button>
          ))}
      </div>
    );
  };
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">MEU BACKSTAGE / GESTÃO</span>
          <h1>{mod.title}</h1>
          <p>{mod.description}</p>
        </div>
        <button className="button dark" onClick={() => open(fresh())}>
          <Plus size={17} />
          Adicionar
        </button>
      </div>
      <div className="manager-toolbar">
        <label className="search-input">
          <Search size={18} />
          <input
            placeholder="Buscar nesta área…"
            aria-label="Buscar registros"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar registros"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos</option>
          {[
            ...statuses,
            ...(kind === "studies"
              ? ["Indústria musical", "Marketing musical", "Produção musical"]
              : []),
            ...(kind === "career"
              ? mod.fields.find((f) => f.key === "path")?.options || []
              : []),
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <div className="view-switch">
          {[
            ["list", "Lista", List],
            ...(mod.status ? [["kanban", "Kanban", LayoutGrid]] : []),
            ...(kind === "calendar"
              ? [
                  ["month", "Mês", CalendarDays],
                  ["week", "Semana", CalendarDays],
                ]
              : []),
          ].map(([key, label, Icon]) => {
            const I = Icon as typeof List;
            return (
              <button
                key={String(key)}
                className={view === key ? "active" : ""}
                onClick={() => setView(String(key))}
              >
                <I size={16} />
                {String(label)}
              </button>
            );
          })}
        </div>
      </div>
      <p className="fine-print">
        {filtered.length} registro(s)
        {kind === "calendar"
          ? " · Datas organizam o planejamento interno. Não publica no site nem nas redes sociais."
          : ""}
      </p>
      <p role="status" className="notice">
        {message}
      </p>
      {!editing && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {view === "list" && (
        <div className="items-list">
          {filtered.map(row)}
          {!filtered.length && (
            <div className="empty">
              <h2>Espaço para um novo movimento.</h2>
              <p>Adicione um registro ou ajuste sua busca.</p>
              <button className="button" onClick={() => open(fresh())}>
                Criar primeiro registro <Plus size={17} />
              </button>
            </div>
          )}
        </div>
      )}
      {view === "kanban" && (
        <>
          <p className="fine-print">
            Arraste cartões ou use o seletor de etapa em cada cartão.
          </p>
          <div className="kanban">
            {statuses.map((status) => (
              <section
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const item = items.find(
                    (x) => x.id === e.dataTransfer.getData("text/plain"),
                  );
                  if (item) void move(item, status);
                }}
              >
                <h2>
                  {status}
                  <span>
                    {filtered.filter((x) => x.status === status).length}
                  </span>
                </h2>
                {filtered.filter((x) => x.status === status).map(kanbanCard)}
              </section>
            ))}
          </div>
          {filtered.some((x) => !x.status) && (
            <div className="admin-card">
              <h3>Sem etapa definida</h3>
              {filtered.filter((x) => !x.status).map(row)}
            </div>
          )}
        </>
      )}
      {(view === "month" || view === "week") && (
        <>
          <div className="calendar-toolbar">
            <button
              className="icon-button"
              aria-label="Período anterior"
              onClick={() =>
                view === "month"
                  ? setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  : setWeek(
                      new Date(
                        week.getFullYear(),
                        week.getMonth(),
                        week.getDate() - 7,
                      ),
                    )
              }
            >
              <ArrowLeft size={19} />
            </button>
            <h2>
              {view === "month"
                ? month.toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })
                : "Semana de " + week.toLocaleDateString("pt-BR")}
            </h2>
            <button
              className="icon-button"
              aria-label="Próximo período"
              onClick={() =>
                view === "month"
                  ? setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  : setWeek(
                      new Date(
                        week.getFullYear(),
                        week.getMonth(),
                        week.getDate() + 7,
                      ),
                    )
              }
            >
              <ArrowRight size={19} />
            </button>
          </div>
          <p className="fine-print">
            Clique em um dia para criar; arraste para mudar a data. No celular,
            edite a data pelo formulário.
          </p>
          <div className="calendar-scroll">
            <div className="calendar-grid">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((x) => (
                <div className="weekday" key={x}>
                  {x}
                </div>
              ))}
              {view === "month"
                ? Array.from({ length: 42 }, (_, i) => {
                    const d = new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      1 - ((month.getDay() + 6) % 7) + i,
                    );
                    return dayCell(d, d.getMonth() !== month.getMonth());
                  })
                : Array.from({ length: 7 }, (_, i) =>
                    dayCell(
                      new Date(
                        week.getFullYear(),
                        week.getMonth(),
                        week.getDate() + i,
                      ),
                    ),
                  )}
            </div>
          </div>
          {filtered.some((x) => !x.date) && (
            <section className="admin-card">
              <h3>Sem data definida</h3>
              {filtered.filter((x) => !x.date).map(row)}
            </section>
          )}
        </>
      )}
      {editing && (
        <dialog
          aria-labelledby="editor-title"
          className="editor-dialog"
          onCancel={closeEditor}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await persist(editing);
                closeEditor();
                setMessage(
                  ["articles", "services", "projects"].includes(kind)
                    ? "Registro salvo. Só itens aprovados e com status público aparecem no site."
                    : "Registro salvo no seu Backstage.",
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Não foi possível salvar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <header>
              <div>
                <span className="eyebrow">{mod.title}</span>
                <h2 id="editor-title">
                  {editing.id ? "Editar registro" : "Um novo movimento"}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar editor"
                onClick={closeEditor}
              >
                <X />
              </button>
            </header>
            {editing.id && (kind === "calendar" || kind === "ideas") && (
              <div className="editor-actions">
                {kind === "calendar" ? (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => runAction("duplicate-calendar")}
                  >
                    <Copy size={16} />
                    Duplicar conteúdo
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => runAction("schedule-idea")}
                  >
                    <CalendarPlus size={16} />
                    Transformar em publicação
                  </button>
                )}
                <p>
                  {kind === "calendar"
                    ? "A cópia começa como ideia e sem data; não publica em redes sociais."
                    : "Cria um planejamento interno e preserva as referências. Repetir a ação abre o mesmo item, sem duplicar a pauta."}
                </p>
              </div>
            )}
            {mod.fields.some((f) => f.key === "attachments") && (
              <section className="attachment-tools">
                <h3>Arquivos do projeto</h3>
                <p>
                  PNG, JPEG, WebP ou PDF · até 10 MB. Todos os arquivos
                  permanecem privados neste painel.
                </p>
                <label className="button">
                  <Upload size={16} />
                  Enviar arquivo
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      setError("");
                      try {
                        const fd = new FormData();
                        fd.set("file", file);
                        const r = await fetch("/api/files", {
                          method: "POST",
                          body: fd,
                        });
                        const result = await r.json();
                        if (!r.ok) throw Error(result.error);
                        setEditing({
                          ...editing,
                          attachments: [
                            editing.attachments,
                            result.name + ": " + result.url,
                          ]
                            .filter(Boolean)
                            .join("\n"),
                          ...(result.image &&
                          mod.fields.some((f) => f.key === "coverImage") &&
                          !editing.coverImage
                            ? { coverImage: result.url }
                            : {}),
                        });
                        setMessage(
                          "Arquivo enviado. Salve o registro para manter a referência.",
                        );
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "Falha no envio.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                {String(editing.attachments || "")
                  .split("\n")
                  .map((line, i) => {
                    const match = line.match(/(\/api\/files\/[a-f0-9]{24})$/);
                    return match ? (
                      <a
                        key={i}
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          downloadAttachment(match[1].split("/").pop()!).catch(
                            (e) => setError(e.message),
                          );
                        }}
                        target="_blank"
                        rel="noreferrer"
                        className="attachment-link"
                      >
                        <Download size={14} />
                        {line.split(": /api")[0]}
                      </a>
                    ) : null;
                  })}
              </section>
            )}
            <div className="editor-fields">
              {mod.fields.map((field) => (
                <div
                  key={field.key}
                  className={
                    field.type === "long" || field.type === "check"
                      ? "wide"
                      : ""
                  }
                >
                  <FieldInput
                    field={field}
                    value={editing[field.key]}
                    onChange={(v) => setEditing({ ...editing, [field.key]: v })}
                  />
                  {field.key === "checklist" &&
                    String(editing.checklist || "").trim() && (
                      <div className="study-checklist">
                        {String(editing.checklist)
                          .split("\n")
                          .filter(Boolean)
                          .map((line, i, lines) => (
                            <label key={i} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={line.startsWith("[x] ")}
                                onChange={(e) => {
                                  const updated = lines.map((l, j) =>
                                    j === i
                                      ? (e.target.checked ? "[x] " : "[ ] ") +
                                        l.replace(/^\[[x ]\] /, "")
                                      : l,
                                  );
                                  const done = updated.filter((l) =>
                                    l.startsWith("[x] "),
                                  ).length;
                                  setEditing({
                                    ...editing,
                                    checklist: updated.join("\n"),
                                    ...(kind === "studies" || kind === "career"
                                      ? {
                                          progress: String(
                                            Math.round(
                                              (done / updated.length) * 100,
                                            ),
                                          ),
                                          status:
                                            done === updated.length
                                              ? "Concluído"
                                              : done
                                                ? "Em andamento"
                                                : kind === "career"
                                                  ? "Explorando"
                                                  : "Não iniciado",
                                        }
                                      : {}),
                                  });
                                }}
                              />
                              {line.replace(/^\[[x ]\] /, "")}
                            </label>
                          ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
            <p role="alert" className="form-error">
              {error}
            </p>
            {deleting ? (
              <div className="delete-confirm">
                <p>
                  Excluir permanentemente este registro? Esta ação não pode ser
                  desfeita.
                </p>
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await fetch(
                        "/api/admin/" + kind + "?id=" + editing.id,
                        { method: "DELETE" },
                      );
                      if (!r.ok) throw Error("Não foi possível excluir.");
                      await refresh();
                      closeEditor();
                      setMessage("Registro excluído.");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erro.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Confirmar exclusão
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setDeleting(false)}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <footer>
                {editing.id && (
                  <button
                    type="button"
                    className="button danger subtle"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 size={17} />
                    Excluir
                  </button>
                )}
                <div>
                  <button
                    type="button"
                    className="button"
                    onClick={closeEditor}
                  >
                    Cancelar
                  </button>
                  <button className="button dark" disabled={busy}>
                    <Save size={17} />
                    {busy ? "Salvando…" : "Salvar registro"}
                  </button>
                </div>
              </footer>
            )}
          </form>
        </dialog>
      )}
    </>
  );
}
