export type Item = {
  id?: string;
  updated?: string;
  [key: string]: string | boolean | undefined;
};
export type Field = {
  key: string;
  label: string;
  type?:
    "text" | "long" | "date" | "email" | "url" | "select" | "check" | "number";
  options?: string[];
  required?: boolean;
};
export type Module = {
  title: string;
  description: string;
  fields: Field[];
  status?: string[];
};
const f = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  options?: string[],
): Field => ({ key, label, type, options });
const common = [{ ...f("title", "Título"), required: true }];
const pub = [
  f("status", "Status", "select", [
    "Rascunho",
    "Em revisão",
    "Publicado",
    "Arquivado",
  ]),
  f("approved", "Aprovado para aparecer no site", "check"),
];
export const categories = [
  "Histórias da música",
  "Cultura brasileira",
  "Artistas e movimentos",
  "Instrumentos musicais",
  "Curiosidades",
  "Indústria musical",
  "Marketing musical",
  "Bastidores da música",
  "Cultura contemporânea",
];
export const ideaCategories = [
  ...categories,
  "Movimentos culturais",
  "Produção musical",
  "Música e sociedade",
];
export const crmStages = [
  "Identificado",
  "Pesquisando",
  "Primeiro contato",
  "Conversando",
  "Proposta enviada",
  "Negociação",
  "Fechado",
  "Perdido",
  "Arquivado",
];
export const calendarStages = [
  "Ideia",
  "Pesquisa",
  "Roteiro",
  "Produção",
  "Revisão",
  "Pronto",
  "Agendado",
  "Publicado",
];
export const modules: Record<string, Module> = {
  articles: {
    title: "Editorial",
    description:
      "Histórias que merecem ser ouvidas. Revise, aprove e publique aqui.",
    fields: [
      ...common,
      f("subtitle", "Subtítulo"),
      f("category", "Categoria", "select", categories),
      f("author", "Autoria"),
      f("date", "Data", "date"),
      f("cover", "Capa gráfica", "select", ["vinyl", "waves", "type"]),
      f("coverImage", "Capa enviada (URL interna)"),
      f("attachments", "Arquivos e referências (privados)", "long"),
      f("body", "Conteúdo", "long"),
      f("references", "Referências e créditos", "long"),
      f("demo", "Conteúdo demonstrativo", "check"),
      ...pub,
    ],
  },
  career: {
    title: "Minha carreira",
    description:
      "Explore caminhos sem precisar escolher uma especialização definitiva. Planejamento, atividades e notas ficam privados.",
    fields: [
      ...common,
      f("path", "Caminho", "select", [
        "Artist Marketing",
        "Music Digital Marketing",
        "Music Branding & Creative Strategy",
        "Audience Development",
        "Indústria musical",
        "Produção musical",
        "DAWs e sampling",
        "Lançamentos musicais",
      ]),
      f("description", "Objetivo profissional", "long"),
      f("skills", "Competências atuais", "long"),
      f("develop", "O que quero desenvolver", "long"),
      f("activity", "Atividade prática", "long"),
      f("references", "Referências", "long"),
      f("notes", "Anotações", "long"),
      f("checklist", "Checklist (uma etapa por linha)", "long"),
      f("progress", "Progresso de 0 a 100", "number"),
      f("deadline", "Próxima revisão", "date"),
      f("status", "Status", "select", [
        "Explorando",
        "Em andamento",
        "Concluído",
        "Pausado",
      ]),
    ],
  },
  services: {
    title: "Serviços",
    description:
      "Um catálogo de possibilidades. Só serviços aprovados, disponíveis ou sob consulta aparecem no site.",
    fields: [
      ...common,
      f("category", "Categoria", "select", [
        "Marketing musical",
        "Marketing cultural",
        "Conteúdo e redes sociais",
        "Design e comunicação visual",
        "Branding e estratégia criativa",
        "CRM e relacionamento",
      ]),
      f("description", "Descrição", "long"),
      f("audience", "Público indicado"),
      f("problem", "Problema que ajuda a resolver", "long"),
      f("objective", "Objetivo do serviço", "long"),
      f("deliverables", "Possíveis entregáveis", "long"),
      f("steps", "Etapas de execução", "long"),
      f("tools", "Ferramentas"),
      f("skills", "Competências exigidas"),
      f("develop", "Competências a desenvolver"),
      f("estimate", "Tempo estimado"),
      f("cost", "Custos internos"),
      f("price", "Precificação interna opcional"),
      f("commercial", "Estratégia comercial", "long"),
      f("examples", "Exemplos de aplicação", "long"),
      f("status", "Disponibilidade", "select", [
        "Disponível",
        "Em desenvolvimento",
        "Sob consulta",
        "Oculto",
        "Arquivado",
      ]),
      f("approved", "Aprovado para divulgação", "check"),
    ],
  },
  projects: {
    title: "Projetos",
    description:
      "Organize projetos internos, editoriais, comerciais e parcerias. Publique somente com aprovação.",
    fields: [
      ...common,
      f("workStatus", "Andamento do projeto", "select", [
        "Ideia",
        "Planejamento",
        "Em andamento",
        "Em revisão",
        "Concluído",
        "Pausado",
      ]),
      f("category", "Categoria"),
      f("type", "Tipo", "select", [
        "Interno",
        "Editorial",
        "Conceitual",
        "Comercial",
        "Parceria",
      ]),
      f("description", "Contexto", "long"),
      f("objective", "Objetivo", "long"),
      f("strategy", "Estratégia", "long"),
      f("steps", "Etapas", "long"),
      f("owner", "Responsável"),
      f("deadline", "Prazo", "date"),
      f("links", "Links e referências de arquivos", "long"),
      f("attachments", "Arquivos e referências (privados)", "long"),
      f("deliverables", "Entregáveis", "long"),
      f("learning", "Aprendizados", "long"),
      f(
        "results",
        "Resultados comprovados (deixe vazio se não houver)",
        "long",
      ),
      f("cover", "Capa gráfica", "select", ["vinyl", "waves", "type"]),
      f("coverImage", "Capa enviada (URL interna)"),
      f("attachments", "Arquivos e referências (privados)", "long"),
      f("conceptual", "Estudo conceitual / fictício", "check"),
      ...pub,
    ],
  },
  leads: {
    title: "Contatos & oportunidades",
    description:
      "Mensagens do site e contatos manuais no mesmo lugar. Nenhuma mensagem é enviada automaticamente.",
    status: crmStages,
    fields: [
      ...common,
      f("organization", "Artista, projeto ou organização"),
      f("niche", "Nicho"),
      f("email", "E-mail", "email"),
      f("phone", "Telefone / WhatsApp"),
      f("social", "Redes sociais", "url"),
      f("source", "Origem"),
      f("interest", "Interesse / tipo de parceria"),
      f("service", "Serviço"),
      f("objective", "Objetivo"),
      f("description", "Mensagem / necessidade", "long"),
      f("reference", "Link de referência", "url"),
      f("deadline", "Prazo desejado", "date"),
      f("budget", "Faixa de orçamento"),
      f("next", "Próxima ação"),
      f("followup", "Acompanhar em", "date"),
      f("notes", "Anotações privadas", "long"),
      f("status", "Etapa", "select", crmStages),
    ],
  },
  calendar: {
    title: "Calendário editorial",
    description:
      "Planejamento interno. “Agendado” não agenda nem publica em redes sociais.",
    status: calendarStages,
    fields: [
      ...common,
      f("theme", "Tema"),
      f("category", "Categoria", "select", categories),
      f("channel", "Canal", "select", [
        "Instagram",
        "TikTok",
        "Blog",
        "YouTube",
        "LinkedIn",
        "Outros",
      ]),
      f("format", "Formato", "select", [
        "Carrossel",
        "Post estático",
        "Reels",
        "Vídeo",
        "Stories",
        "Artigo",
        "Entrevista",
        "Conteúdo educativo",
      ]),
      f("objective", "Objetivo"),
      f("audience", "Público"),
      f("idea", "Ideia central", "long"),
      f("caption", "Legenda", "long"),
      f("script", "Roteiro", "long"),
      f("references", "Referências e links de arquivos", "long"),
      f("attachments", "Arquivos e referências (privados)", "long"),
      f("date", "Data", "date"),
      f("status", "Status", "select", calendarStages),
      f("notes", "Observações", "long"),
    ],
  },
  ideas: {
    title: "Banco de pautas",
    description:
      "Ideias para pesquisar. Verifique fatos e fontes antes da publicação.",
    fields: [
      ...common,
      f("summary", "Resumo", "long"),
      f("category", "Categoria", "select", ideaCategories),
      f("angle", "Ângulo editorial", "long"),
      f("sources", "Fontes a pesquisar", "long"),
      f("format", "Formato recomendado"),
      f("developments", "Possíveis desdobramentos", "long"),
      f("status", "Status", "select", [
        "Ideia",
        "Pesquisando",
        "Em produção",
        "Concluída",
        "Arquivada",
      ]),
      f("priority", "Prioridade", "select", ["Baixa", "Média", "Alta"]),
    ],
  },
  tasks: {
    title: "Tarefas",
    description:
      "Um passo possível por vez. Respeite sua disponibilidade semanal.",
    fields: [
      ...common,
      f("description", "Descrição", "long"),
      f("deadline", "Prazo", "date"),
      f("status", "Status", "select", [
        "A fazer",
        "Em andamento",
        "Concluída",
        "Arquivada",
      ]),
      f("priority", "Prioridade", "select", ["Baixa", "Média", "Alta"]),
    ],
  },
  goals: {
    title: "Metas & planejamento",
    description:
      "Objetivos da marca, da carreira e decisões sobre o orçamento.",
    fields: [
      ...common,
      f("type", "Tipo", "select", [
        "Marca",
        "Profissional",
        "Mensal",
        "Orçamento",
        "Decisão",
        "Conquista",
        "Ideia futura",
      ]),
      f("description", "Plano de ação", "long"),
      f("budget", "Orçamento previsto"),
      f("deadline", "Prazo", "date"),
      f("status", "Status", "select", [
        "Em planejamento",
        "Em andamento",
        "Concluída",
        "Arquivada",
      ]),
    ],
  },
  studies: {
    title: "Academia musical",
    description:
      "Aprender para criar com mais repertório. Sem obrigação de se tornar produtora.",
    fields: [
      ...common,
      f("track", "Trilha", "select", [
        "Indústria musical",
        "Marketing musical",
        "Produção musical",
      ]),
      f("description", "Introdução e explicação", "long"),
      f("objective", "Objetivos", "long"),
      f("exercise", "Exercício", "long"),
      f("references", "Referências", "long"),
      f("checklist", "Checklist (uma etapa por linha)", "long"),
      f("progress", "Progresso de 0 a 100", "number"),
      f("notes", "Anotações", "long"),
      f("status", "Status", "select", [
        "Não iniciado",
        "Em andamento",
        "Concluído",
      ]),
    ],
  },
  notes: {
    title: "Diário de bordo",
    description: "Guarde aprendizados, descobertas e decisões.",
    fields: [
      ...common,
      f("date", "Data", "date"),
      f("description", "Registro", "long"),
      f("learning", "Aprendizado", "long"),
      f("next", "Próximo passo"),
    ],
  },
  ecosystem: {
    title: "Ecossistema",
    description: "Possibilidades de expansão, não operações comerciais ativas.",
    fields: [
      ...common,
      f("description", "Ideia", "long"),
      f("objective", "Objetivos", "long"),
      f("audience", "Público"),
      f("resources", "Recursos necessários", "long"),
      f("cost", "Custos estimados"),
      f("risks", "Riscos", "long"),
      f("validation", "Teste de validação", "long"),
      f("next", "Próximos passos", "long"),
      f("status", "Status", "select", [
        "Possibilidade futura",
        "Em pesquisa",
        "Em validação",
        "Pausado",
      ]),
    ],
  },
  planning: {
    title: "Pilares de conteúdo",
    description:
      "Um calendário realista: uma publicação quinzenal é um bom ponto de partida.",
    fields: [
      ...common,
      f("description", "Pilar editorial", "long"),
      f("frequency", "Frequência"),
      f("objective", "Objetivo", "long"),
      f("status", "Status", "select", ["Em planejamento", "Ativo", "Pausado"]),
    ],
  },
  lab: {
    title: "Incômodo Lab",
    description:
      "Experimentos, portfólio e projetos fictícios explicitamente identificados.",
    fields: [
      ...common,
      f("type", "Tipo", "select", [
        "Estudo conceitual",
        "Experimento autoral",
        "Análise de campanha real",
      ]),
      f("description", "Contexto", "long"),
      f("brief", "Briefing", "long"),
      f("strategy", "Estratégia", "long"),
      f("steps", "Etapas", "long"),
      f("deliverables", "Entregáveis", "long"),
      f("checklist", "Checklist", "long"),
      f("links", "Links e referências de arquivos", "long"),
      f("attachments", "Arquivos e referências (privados)", "long"),
      f("learning", "Aprendizados", "long"),
      f("status", "Status", "select", [
        "Ideia",
        "Pesquisa",
        "Produção",
        "Concluído",
        "Arquivado",
      ]),
    ],
  },
};
export const settingFields: Field[] = [
  f("about", "Sobre a Incômodo", "long"),
  f("founder", "Apresentação da fundadora (opcional, pública)", "long"),
  f("manifesto", "Manifesto", "long"),
  f("mission", "Missão", "long"),
  f("vision", "Visão", "long"),
  f("values", "Valores (Nome: descrição, um por linha)", "long"),
  f("email", "E-mail público", "email"),
  f(
    "recipientEmail",
    "E-mail destinatário futuro (não envia sem integração)",
    "email",
  ),
  f("whatsapp", "WhatsApp oficial com DDI, apenas números"),
  f("instagram", "Instagram", "url"),
  f("tiktok", "TikTok", "url"),
  f("youtube", "YouTube", "url"),
  f("linkedin", "LinkedIn", "url"),
  f("weeklyHours", "Horas disponíveis por semana"),
];
export function validate(fields: Field[], value: unknown): Item {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Dados inválidos.");
  const obj = value as Record<string, unknown>;
  const out: Item = {};
  for (const field of fields) {
    const v = obj[field.key];
    if (field.type === "check") {
      out[field.key] = v === true;
      continue;
    }
    if (v === undefined) {
      if (field.required) throw Error(`${field.label} é obrigatório.`);
      continue;
    }
    if (typeof v !== "string") throw Error(`${field.label}: valor inválido.`);
    const s = v.trim();
    if (
      field.key === "coverImage" &&
      s &&
      !/^\/api\/files\/[a-f0-9]{24}$/.test(s)
    )
      throw Error("Use uma imagem enviada pelo painel.");
    if (s.length > (field.type === "long" ? 40000 : 1000))
      throw Error(`${field.label}: texto muito longo.`);
    if (field.required && !s) throw Error(`${field.label} é obrigatório.`);
    if (s && field.options && !field.options.includes(s))
      throw Error(`${field.label}: opção inválida.`);
    if (
      s &&
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)))
    )
      throw Error("Data inválida.");
    if (s && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
      throw Error("E-mail inválido.");
    if (s && field.type === "url") {
      try {
        const u = new URL(s);
        if (!["https:", "http:"].includes(u.protocol)) throw Error();
      } catch {
        throw Error("Use um endereço http ou https válido.");
      }
    }
    if (
      s &&
      field.type === "number" &&
      (!Number.isFinite(Number(s)) ||
        Number(s) < 0 ||
        Number(s) > (field.key === "progress" ? 100 : 1000000000))
    )
      throw Error("Progresso deve estar entre 0 e 100.");
    out[field.key] = s;
  }
  return out;
}
