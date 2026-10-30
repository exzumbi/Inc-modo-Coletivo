import {
  modules as original,
  type Item,
  type Module,
  type Field,
  validate,
} from "./original-schema";
export { type Item, type Field, validate };
export const groups = [
  { id: "ideas", label: "Ideias", kinds: ["ideas"] },
  { id: "calendar", label: "Calendário", kinds: ["calendar", "planning"] },
  { id: "contents", label: "Conteúdos", kinds: ["articles"] },
  {
    id: "projects",
    label: "Projetos e tarefas",
    kinds: ["projects", "tasks", "lab"],
  },
  { id: "studies", label: "Estudos", kinds: ["studies", "career", "notes"] },
  {
    id: "results",
    label: "Resultados",
    kinds: ["results", "goals", "ecosystem"],
  },
];
export const modules: Record<string, Module> = {};
for (const kind of groups.flatMap((g) => g.kinds))
  if (original[kind]) {
    const m = original[kind];
    const seen = new Set<string>();
    modules[kind] = {
      ...m,
      fields: m.fields
        .filter(
          (f) =>
            !["approved", "cost", "price", "budget", "commercial"].includes(
              f.key,
            ),
        )
        .filter((f) => {
          if (seen.has(f.key)) return false;
          seen.add(f.key);
          return true;
        }),
    };
  }
modules.articles = {
  ...modules.articles,
  title: "Rascunhos e conteúdos",
  description:
    "Planeje e escreva. O status Publicado é um registro interno; não modifica o site público.",
};
modules.projects = {
  ...modules.projects,
  description:
    "Organização criativa de projetos. Nenhum registro deste painel é publicado no site.",
};
modules.results = {
  title: "Resultados registrados",
  description:
    "Anote resultados reais e aprendizados. Não há integração automática com redes sociais.",
  fields: [
    { key: "title", label: "Título", required: true },
    { key: "date", label: "Data", type: "date" },
    { key: "channel", label: "Canal" },
    { key: "links", label: "Link da publicação", type: "url" },
    ...["reach", "views", "likes", "comments", "saves"].map((key, i) => ({
      key,
      label: [
        "Alcance",
        "Visualizações",
        "Curtidas",
        "Comentários",
        "Salvamentos",
      ][i],
      type: "number" as const,
    })),
    { key: "learning", label: "Aprendizados", type: "long" },
    { key: "next", label: "Próximo passo", type: "long" },
  ],
};
// Preserved fields outside the form remain in each imported record's JSON.
