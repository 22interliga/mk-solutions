/* =========================================================================
   MK-SOLUTIONS · Camada de dados (store)
   Responsável por: estado, seed inicial, persistência (localStorage),
   seletores e cálculo de indicadores. Nenhuma lógica de UI aqui.
   ========================================================================= */
(function () {
  "use strict";

  const KEY = "mk_solutions_state_v2"; // v2: seed a partir da planilha real (fluxograma_mk_solutions.csv)
  const TODAY = "2026-08-15"; // referência de "hoje" para classificação de prazo

  /* ---- catálogos ------------------------------------------------------- */
  const PRIORITIES = ["baixa", "media", "alta", "critica"];
  const STATUSES = ["pendente", "andamento", "revisao", "bloqueada", "concluida", "cancelada"];
  const DEPARTMENTS = ["Operacional", "Administrativo", "Desenvolvimento", "Diretoria", "Vendas", "Marketing"];
  const ROLES = ["admin", "gestor", "colaborador"];

  const STATUS_LABEL = {
    pendente: "Pendente",
    andamento: "Em andamento",
    revisao: "Em revisão",
    bloqueada: "Bloqueada",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };
  const PRIORITY_LABEL = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
  const ROLE_LABEL = { admin: "Administrador", gestor: "Gestor", colaborador: "Colaborador" };

  /* ---- utilidades de id/data ------------------------------------------ */
  let _seq = 1000;
  const uid = (p) => `${p}-${++_seq}`;
  const nowISO = () => new Date().toISOString();

  /* ---- seed ------------------------------------------------------------ */
  function seed() {
    const u = (name, email, role, department) => ({
      id: uid("u"), name, email, role, department,
      avatar: initials(name), active: true, created_at: nowISO(),
    });

    const users = [
      u("Miqueias", "miqueias@mk-solutions.app", "admin", "Desenvolvimento"),
      u("Misael", "misael@mk-solutions.app", "gestor", "Operacional"),
      u("Keven", "keven@mk-solutions.app", "colaborador", "Operacional"),
    ];
    const byName = (n) => (users.find((x) => x.name === n) || {}).id || null;

    const T = (o) => Object.assign({
      id: uid("t"),
      description: "",
      category: "Operacional",
      department: "Operacional",
      responsible_id: null,
      priority: "media",
      status: "pendente",
      start_date: TODAY,
      due_date: "",
      created_by: byName("Miqueias"),
      created_at: nowISO(),
      updated_at: nowISO(),
      subtasks: [],
    }, o);

    const st = (title, o) => Object.assign({ id: uid("s"), title, status: "pendente", responsible_id: null, due_date: "" }, o || {});
    const sub = (chain) => chain.split(" > ").map((x) => st(x.trim()));

    // Atividades operacionais — dados reais de fluxograma_mk_solutions.csv.
    // A planilha não define responsável nem prazo para estas: entram NÃO atribuídas
    // e SEM prazo (⚫). A distribuição e as datas são definidas dentro do sistema.
    const tasks = [
      T({ title: "Fechamento de Quinzena", priority: "alta" }),
      T({ title: "Análise e Validação de Pagamentos", priority: "alta" }),
      T({ title: "Gestão Orçamentária", priority: "alta",
          subtasks: sub("Contas a pagar > Em atraso > Compras > Gestão de despesas > Conferência") }),
      T({ title: "Backlog / Acareações", priority: "media" }),
      T({ title: "Devolução", priority: "media" }),
      T({ title: "Controle de Cadastros", priority: "alta",
          subtasks: sub("Base > Cliente > Perfil > Veículo > Inativos > Aptos > Pendentes") }),
      T({ title: "Ranking Driver", priority: "alta",
          subtasks: sub("Qualidade de serviço > Produtividade > Flexibilidade") }),
      T({ title: "Análise KPIs", priority: "alta" }),
      T({ title: "Atualização SLA Geral", priority: "alta",
          subtasks: sub("Ranking SLA > Base > Motorista > Localidade") }),
      T({ title: "Estruturação", priority: "alta",
          subtasks: sub("Setor de compras > Chamados > Pendências > Dashboard operacional > Controle de absenteísmo") }),
    ];

    // Diretoria — dados reais da planilha (responsável como texto livre p/ "Todos"/"A definir").
    const directory = [
      { id: uid("d"), area: "Desenvolvimento Painel", task: "Automações / Layout", responsible: "Miqueias", status: "pendente" },
      { id: uid("d"), area: "Operacional", task: "Gestão operacional", responsible: "Misael", status: "pendente" },
      { id: uid("d"), area: "Gestão de Tarefas", task: "Identificação e necessidades do portal", responsible: "Keven", status: "pendente" },
      { id: uid("d"), area: "Vendas", task: "Precificação do projeto e ticket médio", responsible: "Todos", status: "pendente" },
      { id: uid("d"), area: "Contato com Bases", task: "Busca de contato por bases existentes", responsible: "Keven", status: "pendente" },
      { id: uid("d"), area: "Apresentação do Projeto", task: "Organização", responsible: "Misael", status: "pendente" },
      { id: uid("d"), area: "Gestão Orçamentária", task: "Orçamento do projeto", responsible: "Todos", status: "pendente" },
      { id: uid("d"), area: "Design / Marca", task: "Desenvolvimento da marca", responsible: "Todos", status: "pendente" },
      { id: uid("d"), area: "Marketing", task: "Instagram / TikTok / Design da marca", responsible: "A definir", status: "pendente" },
    ];

    const history = tasks.map((t) => ({
      id: uid("h"), task_id: t.id, user_id: byName("Miqueias"),
      action: "criou", old_value: "", new_value: t.title, created_at: t.created_at,
    }));

    return { users, tasks, directory, comments: [], notifications: [], history, session: null, _seq };
  }

  function initials(name) {
    const p = String(name).trim().split(/\s+/);
    return ((p[0] || "")[0] || "") + ((p[1] || "")[0] || (p[0] || "")[1] || "");
  }

  /* ---- persistência ---------------------------------------------------- */
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); _seq = s._seq || _seq; return s; }
    } catch (e) { /* estado corrompido — recria */ }
    const s = seed(); s._seq = _seq; persist(s); return s;
  }
  function persist(s) {
    (s || state)._seq = _seq;
    try { localStorage.setItem(KEY, JSON.stringify(s || state)); } catch (e) {}
  }
  function reset() { state = seed(); state._seq = _seq; persist(); }

  /* ---- seletores ------------------------------------------------------- */
  const users = () => state.users;
  const activeUsers = () => state.users.filter((u) => u.active);
  const userById = (id) => state.users.find((u) => u.id === id) || null;
  const userName = (id) => (userById(id) || {}).name || "—";
  const tasks = () => state.tasks;
  const taskById = (id) => state.tasks.find((t) => t.id === id) || null;
  const directory = () => state.directory;
  const notifications = () => state.notifications.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const unreadCount = () => state.notifications.filter((n) => !n.read).length;
  const historyFor = (taskId) => state.history.filter((h) => h.task_id === taskId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const commentsFor = (taskId) => state.comments.filter((c) => c.task_id === taskId).sort((a, b) => a.created_at.localeCompare(b.created_at));

  /* ---- classificação de prazo (semáforo) ------------------------------- */
  function daysUntil(due) {
    if (!due) return null;
    const d = new Date(due + "T00:00:00"), t = new Date(TODAY + "T00:00:00");
    return Math.round((d - t) / 86400000);
  }
  // retorna: 'ok' | 'soon' | 'late' | 'none' | 'done'
  function deadlineStatus(task) {
    if (task.status === "concluida" || task.status === "cancelada") return "done";
    if (!task.due_date) return "none";
    const d = daysUntil(task.due_date);
    if (d < 0) return "late";
    if (d <= 3) return "soon";
    return "ok";
  }

  /* ---- métricas -------------------------------------------------------- */
  function metrics() {
    const t = state.tasks;
    const total = t.length;
    const by = (s) => t.filter((x) => x.status === s).length;
    const concluida = by("concluida");
    const cancelada = by("cancelada");
    const pendente = by("pendente");
    const andamento = by("andamento");
    const revisao = by("revisao");
    const bloqueada = by("bloqueada");
    const atrasada = t.filter((x) => deadlineStatus(x) === "late").length;
    const critica = t.filter((x) => x.priority === "critica" && x.status !== "concluida" && x.status !== "cancelada").length;
    const base = total - cancelada; // canceladas não contam no progresso
    const progresso = base > 0 ? Math.round((concluida / base) * 100) : 0;
    // SLA: dentro do prazo entre as que têm prazo definido e não canceladas
    const comPrazo = t.filter((x) => x.due_date && x.status !== "cancelada");
    const dentro = comPrazo.filter((x) => deadlineStatus(x) !== "late").length;
    const sla = comPrazo.length ? Math.round((dentro / comPrazo.length) * 100) : 100;
    return { total, concluida, cancelada, pendente, andamento, revisao, bloqueada,
             atrasada, critica, progresso, sla, ativos: pendente + andamento + revisao + bloqueada };
  }

  function progressByUser() {
    return activeUsers().map((u) => {
      const mine = state.tasks.filter((t) => t.responsible_id === u.id && t.status !== "cancelada");
      const done = mine.filter((t) => t.status === "concluida").length;
      return { id: u.id, name: u.name, total: mine.length, done,
               pct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
    });
  }
  function countBy(field) {
    const map = {};
    state.tasks.forEach((t) => { const k = t[field] || "—"; map[k] = (map[k] || 0) + 1; });
    return map;
  }
  function tasksByResponsible() {
    return activeUsers().map((u) => ({
      label: u.name,
      value: state.tasks.filter((t) => t.responsible_id === u.id).length,
    }));
  }

  /* ---- mutações (com histórico + notificações) ------------------------- */
  function log(task_id, action, old_value, new_value) {
    state.history.push({ id: uid("h"), task_id, user_id: (state.session || {}).id || null,
      action, old_value: old_value || "", new_value: new_value || "", created_at: nowISO() });
  }
  function notify(user_id, task_id, type, message) {
    if (!user_id) return;
    state.notifications.push({ id: uid("n"), user_id, task_id, type, message, read: false, created_at: nowISO() });
  }
  function actorName() { return (state.session || {}).name || "Sistema"; }

  function createTask(data) {
    const t = Object.assign({
      id: uid("t"), title: "", description: "", category: "Operacional", department: "Operacional",
      responsible_id: null, priority: "media", status: "pendente",
      start_date: TODAY, due_date: "", created_by: (state.session || {}).id || null,
      created_at: nowISO(), updated_at: nowISO(), subtasks: [],
    }, data);
    state.tasks.push(t);
    log(t.id, "criou", "", t.title);
    notify(t.responsible_id, t.id, "atribuicao", `Nova tarefa atribuída: “${t.title}”.`);
    persist();
    return t;
  }

  function updateTask(id, patch) {
    const t = taskById(id); if (!t) return null;
    const prevResp = t.responsible_id, prevStatus = t.status;
    Object.assign(t, patch, { updated_at: nowISO() });
    if (patch.status && patch.status !== prevStatus)
      log(id, "alterou status", STATUS_LABEL[prevStatus], STATUS_LABEL[patch.status]);
    if ("responsible_id" in patch && patch.responsible_id !== prevResp) {
      log(id, "alterou responsável", userName(prevResp), userName(patch.responsible_id));
      notify(patch.responsible_id, id, "responsavel", `Você agora é responsável por “${t.title}”.`);
    }
    if (patch.status === "concluida" && prevStatus !== "concluida")
      notify(t.responsible_id, id, "concluida", `Tarefa concluída: “${t.title}”.`);
    persist();
    return t;
  }

  function setStatus(id, status) { return updateTask(id, { status }); }

  function deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    state.history = state.history.filter((h) => h.task_id !== id);
    state.comments = state.comments.filter((c) => c.task_id !== id);
    state.notifications = state.notifications.filter((n) => n.task_id !== id);
    persist();
  }

  function addComment(task_id, text) {
    const c = { id: uid("c"), task_id, user_id: (state.session || {}).id || null,
      comment: text, created_at: nowISO() };
    state.comments.push(c);
    log(task_id, "comentou", "", text);
    const t = taskById(task_id);
    if (t) notify(t.responsible_id, task_id, "comentario", `Novo comentário em “${t.title}”.`);
    persist();
    return c;
  }

  function toggleSubtask(taskId, subId) {
    const t = taskById(taskId); if (!t) return;
    const s = (t.subtasks || []).find((x) => x.id === subId); if (!s) return;
    s.status = s.status === "concluida" ? "pendente" : "concluida";
    t.updated_at = nowISO();
    persist();
  }

  /* ---- usuários -------------------------------------------------------- */
  function createUser(data) {
    const u = Object.assign({ id: uid("u"), name: "", email: "", role: "colaborador",
      department: "Operacional", avatar: "", active: true, created_at: nowISO() }, data);
    u.avatar = u.avatar || initials(u.name);
    state.users.push(u); persist(); return u;
  }
  function updateUser(id, patch) {
    const u = userById(id); if (!u) return null;
    Object.assign(u, patch);
    if (patch.name) u.avatar = initials(patch.name);
    persist(); return u;
  }
  function deleteUser(id) {
    const u = userById(id); if (u) u.active = false; // desativa (preserva histórico/tarefas)
    persist();
  }

  /* ---- diretoria ------------------------------------------------------- */
  function upsertDirectory(row) {
    if (row.id) {
      const r = state.directory.find((x) => x.id === row.id);
      if (r) Object.assign(r, row);
    } else {
      state.directory.push(Object.assign({ id: uid("d"), status: "pendente" }, row));
    }
    persist();
  }
  function deleteDirectory(id) {
    state.directory = state.directory.filter((r) => r.id !== id); persist();
  }

  /* ---- sessão ---------------------------------------------------------- */
  function login(userId) { state.session = userById(userId); persist(); return state.session; }
  function logout() { state.session = null; persist(); }
  function session() { return state.session; }
  function can(action) {
    const r = (state.session || {}).role;
    if (r === "admin") return true;
    if (r === "gestor") return action !== "manageUsers" && action !== "settings";
    // colaborador
    return action === "updateStatus" || action === "comment";
  }
  function markAllRead() {
    state.notifications.forEach((n) => (n.read = true)); persist();
  }

  /* ---- API pública ----------------------------------------------------- */
  window.MK = window.MK || {};
  window.MK.store = {
    TODAY, PRIORITIES, STATUSES, DEPARTMENTS, ROLES,
    STATUS_LABEL, PRIORITY_LABEL, ROLE_LABEL,
    persist, reset, initials, daysUntil, deadlineStatus,
    users, activeUsers, userById, userName, tasks, taskById, directory,
    notifications, unreadCount, historyFor, commentsFor,
    metrics, progressByUser, countBy, tasksByResponsible, actorName,
    createTask, updateTask, setStatus, deleteTask, addComment, toggleSubtask,
    createUser, updateUser, deleteUser, upsertDirectory, deleteDirectory,
    login, logout, session, can, markAllRead,
  };
})();
