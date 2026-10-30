import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import {
  Lightbulb,
  CalendarDays,
  FileText,
  Briefcase,
  GraduationCap,
  BarChart3,
  Menu,
  X,
  LogOut,
  Download,
  Upload,
  RefreshCw,
} from "lucide-react";
import { Manager } from "./Manager";
import { groups, modules, type Item } from "./lib/schema";
import { configured, supabase, client } from "./lib/client";
import { list, exportBackup, importBackup } from "./lib/repository";
import "./original.css";
import "./style.css";
const icons = [
  Lightbulb,
  CalendarDays,
  FileText,
  Briefcase,
  GraduationCap,
  BarChart3,
];
function Brand({ dark = false }: { dark?: boolean }) {
  return dark ? (
    <svg
      role="img"
      aria-label="Incômodo Coletivo"
      viewBox="22 232 705 256"
      className="creative-logo"
    >
      <image
        href="/brand/dark-horizontal.png"
        width="750"
        height="750"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  ) : (
    <img
      className="creative-logo"
      src="/brand/horizontal.png"
      alt="Incômodo Coletivo"
    />
  );
}
function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="creative-login">
      <section>
        <Brand />
        <span className="eyebrow">SEU ESPAÇO DE CRIAÇÃO</span>
        <h1>Meu Backstage</h1>
        <p>Ideias, pesquisa e projetos. No seu ritmo.</p>
        <img className="login-ghost" src="/brand/mascot.png" alt="" />
      </section>
      <section className="login-card">
        <h2>Entre no seu espaço</h2>
        <p>Acesso privado. Não há cadastro público.</p>
        {!configured ? (
          <div role="status" className="setup-note">
            O painel está preparado, mas o projeto Supabase ainda precisa ser
            conectado. Login e salvamento online não estão disponíveis nesta
            instalação.
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const { error } = await client().auth.signInWithPassword({
                  email,
                  password,
                });
                if (error)
                  throw Error(
                    "Não foi possível entrar. Confira seus dados ou aguarde antes de tentar novamente.",
                  );
                setPassword("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Não foi possível conectar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <p role="alert" className="form-error">
              {error}
            </p>
            <button className="button dark" disabled={busy}>
              {busy ? "Entrando…" : "Entrar no Meu Backstage"}
            </button>
          </form>
        )}
        <p className="fine-print">
          As suas informações são privadas. Este painel não altera o site
          público.
        </p>
      </section>
    </main>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(!configured),
    [allowed, setAllowed] = useState(false),
    [authError, setAuthError] = useState("");
  const [hash, setHash] = useState(location.hash || "#/ideas"),
    [open, setOpen] = useState(false),
    [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [transfer, setTransfer] = useState(false),
    [importFile, setImportFile] = useState<File | null>(null);
  const candidate = hash.replace(/^#\/?/, "").split("?")[0] || "ideas";
  const kind = modules[candidate] ? candidate : "ideas";
  const group = groups.find((g) => g.kinds.includes(kind))!;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (document.querySelector("dialog[open]")) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    const listener = () => {
      setHash(location.hash);
      setOpen(false);
      setError("");
      setMessage("");
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError("Não foi possível recuperar a sessão.");
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) {
        setSession(s);
        if (!s) {
          setAllowed(false);
          setItems([]);
        }
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!session) {
      setAllowed(false);
      return;
    }
    let active = true;
    setAuthError("");
    (async () => {
      try {
        const auth = await client().auth.getUser();
        if (auth.error || !auth.data.user)
          throw Error("Sessão inválida. Entre novamente.");
        const owner = await client()
          .from("backstage_owners")
          .select("user_id")
          .eq("user_id", auth.data.user.id)
          .maybeSingle();
        if (owner.error || !owner.data)
          throw Error("Esta conta não está autorizada para o Meu Backstage.");
        if (active) setAllowed(true);
      } catch (e) {
        if (active) {
          setAllowed(false);
          setAuthError(
            e instanceof Error
              ? e.message
              : "Não foi possível verificar seu acesso.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user.id]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    list(kind)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, kind, revision]);
  const logout = async () => {
    setError("");
    const { error } = await client().auth.signOut({ scope: "local" });
    if (error) {
      setError("Não foi possível encerrar a sessão. Tente novamente.");
      return;
    }
    setSession(null);
    setAllowed(false);
    setItems([]);
    setImportFile(null);
  };
  const refresh = () => {
    if (document.querySelector("dialog[open]")) {
      setError("Salve ou feche o editor antes de atualizar a lista.");
      return;
    }
    setRevision((r) => r + 1);
  };
  if (!authReady)
    return (
      <main className="access-message" role="status">
        Verificando sua sessão…
      </main>
    );
  if (!session) return <Login />;
  if (!allowed)
    return (
      <main className="access-message">
        <Brand />
        <h1>Acesso privado</h1>
        <p role={authError ? "alert" : "status"}>
          {authError || "Conferindo sua autorização…"}
        </p>
        <button className="button dark" onClick={logout}>
          Sair
        </button>
      </main>
    );
  return (
    <div className="admin-app">
      <aside className={"admin-sidebar " + (open ? "sidebar-open" : "")}>
        <a className="wordmark" href="#/ideas">
          <Brand dark />
          <small>MEU BACKSTAGE / ORGANIZAÇÃO CRIATIVA</small>
        </a>
        <nav aria-label="Organização criativa">
          {groups.map((g, i) => {
            const Icon = icons[i];
            return (
              <a
                href={"#/" + g.kinds[0]}
                className={group.id === g.id ? "active" : ""}
                key={g.id}
              >
                <Icon size={18} />
                {g.label}
              </a>
            );
          })}
        </nav>
        <p className="sidebar-note">
          Planeje, pesquise e crie.
          <br />O site público continua independente.
        </p>
        <button className="logout-button" onClick={logout}>
          <LogOut size={17} />
          Sair da conta
        </button>
      </aside>
      <div className="admin-body">
        <header className="admin-topbar">
          <button
            className="admin-menu"
            aria-label={open ? "Fechar navegação" : "Abrir navegação"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <span>NO SEU RITMO. COM PROPÓSITO.</span>
          <span className="private-badge">ÁREA PRIVADA</span>
        </header>
        <main className="admin-main">
          <div className="creative-tools">
            <strong>{group.label}</strong>
            <button
              className="button subtle"
              onClick={refresh}
              disabled={loading || transfer}
            >
              <RefreshCw size={16} />
              Atualizar
            </button>
            <button
              className="button subtle"
              disabled={transfer}
              onClick={async () => {
                if (document.querySelector("dialog[open]")) {
                  setError("Salve e feche o editor antes do backup.");
                  return;
                }
                setTransfer(true);
                setError("");
                try {
                  const n = await exportBackup();
                  setMessage(
                    `Backup completo exportado: ${n} registros. Guarde o arquivo em local privado.`,
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Erro ao exportar.",
                  );
                } finally {
                  setTransfer(false);
                }
              }}
            >
              <Download size={16} />
              {transfer ? "Aguarde…" : "Exportar backup"}
            </button>
            <label className="button subtle">
              <Upload size={16} />
              Importar cópia
              <input
                type="file"
                accept="application/json,.json"
                disabled={transfer}
                className="sr-only"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {group.kinds.length > 1 && (
            <nav className="creative-tabs" aria-label="Tipos de registro">
              {group.kinds.map((k) => (
                <a
                  className={kind === k ? "active" : ""}
                  href={"#/" + k}
                  key={k}
                >
                  {modules[k].title}
                </a>
              ))}
            </nav>
          )}
          {message && (
            <p role="status" className="success-note">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {importFile && (
            <section className="admin-card import-confirm">
              <h2>Importar uma cópia privada</h2>
              <p>
                Registros iguais serão ignorados. Registros diferentes com o
                mesmo ID não serão sobrescritos. A operação só usará este banco;
                o original não será alterado.
              </p>
              <p>Arquivo: {importFile.name}</p>
              <button
                className="button dark"
                disabled={transfer}
                onClick={async () => {
                  setTransfer(true);
                  setError("");
                  try {
                    const r = await importBackup(importFile);
                    setMessage(
                      `Importação concluída: ${r.imported} novos; ${r.skipped} já existentes.`,
                    );
                    setImportFile(null);
                    setRevision((x) => x + 1);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Não foi possível importar.",
                    );
                  } finally {
                    setTransfer(false);
                  }
                }}
              >
                Validar e importar cópia
              </button>
              <button
                className="button"
                disabled={transfer}
                onClick={() => setImportFile(null)}
              >
                Cancelar
              </button>
            </section>
          )}
          {loading ? (
            <p role="status">Carregando seus registros…</p>
          ) : (
            !error && (
              <Manager
                kind={kind}
                initial={items}
                key={kind + ":" + revision}
              />
            )
          )}
        </main>
        <footer className="admin-footer">
          Seus dados ficam no Supabase privado. Resultados são registros
          manuais, sem métricas inventadas.
        </footer>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
