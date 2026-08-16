/* =========================================================================
   MK-SOLUTIONS · Camada de apresentação (views)
   Cada função retorna um nó DOM da tela. Sem persistência aqui —
   toda mutação passa por MK.store e re-renderiza via MK.app.render().
   ========================================================================= */
(function () {
  "use strict";
  const S = window.MK.store, U = window.MK.ui, el = U.el;
  const rerender = () => window.MK.app.render();

  const statusOpts = () => S.STATUSES.map((s) => ({ value: s, label: S.STATUS_LABEL[s] }));
  const prioOpts = () => S.PRIORITIES.map((p) => ({ value: p, label: S.PRIORITY_LABEL[p] }));
  const deptOpts = () => S.DEPARTMENTS.map((d) => ({ value: d, label: d }));
  const userOpts = (withNull) => {
    const o = S.activeUsers().map((u) => ({ value: u.id, label: u.name }));
    return withNull ? [{ value: "", label: "— sem responsável —" }].concat(o) : o;
  };

  function pageHead(title, subtitle, actions) {
    return el("div", { class: "page-head" }, [
      el("div", {}, [el("h1", {}, title), subtitle && el("p", { class: "page-sub", text: subtitle })]),
      actions && el("div", { class: "page-actions" }, actions),
    ]);
  }

  /* ===================== DASHBOARD ====================================== */
  function statCard(label, value, tone, hint) {
    return el("div", { class: "stat " + (tone || "") }, [
      el("div", { class: "stat-value", text: String(value) }),
      el("div", { class: "stat-label", text: label }),
      hint && el("div", { class: "stat-hint", text: hint }),
    ]);
  }

  function dashboard() {
    const m = S.metrics();
    const wrap = el("div", {});
    wrap.appendChild(pageHead("Dashboard", "Visão geral da operação"));

    wrap.appendChild(el("div", { class: "stats-grid" }, [
      statCard("Total de tarefas", m.total),
      statCard("Pendentes", m.pendente, "tone-neutral"),
      statCard("Em andamento", m.andamento, "tone-info"),
      statCard("Concluídas", m.concluida, "tone-ok"),
      statCard("Atrasadas", m.atrasada, "tone-danger"),
      statCard("Críticas", m.critica, "tone-crit"),
    ]));

    // progresso geral
    const prog = el("div", { class: "card prog-card" }, [
      el("div", { class: "prog-head" }, [
        el("h3", {}, "Progresso geral"),
        el("span", { class: "prog-pct mono", text: m.progresso + "%" }),
      ]),
      el("div", { class: "progress" }, [progBar(m.progresso)]),
      el("p", { class: "muted small", text: `${m.concluida} de ${m.total - m.cancelada} tarefas concluídas (canceladas não contam).` }),
    ]);
    wrap.appendChild(prog);

    // gráficos
    const statusData = S.STATUSES.filter((s) => S.countBy("status")[s])
      .map((s) => ({ label: S.STATUS_LABEL[s], value: S.countBy("status")[s], color: U.COLORS.status[s] }));
    const respData = S.tasksByResponsible().map((d) => ({ label: d.label, value: d.value }));
    const deptMap = S.countBy("department");
    const deptData = Object.keys(deptMap).map((k) => ({ label: k, value: deptMap[k] }));

    const donutSegs = [
      { label: "Concluídas", value: m.concluida, color: U.COLORS.status.concluida },
      { label: "Ativas", value: m.ativos, color: U.COLORS.status.andamento },
      { label: "Canceladas", value: m.cancelada, color: U.COLORS.status.cancelada },
    ];

    wrap.appendChild(el("div", { class: "grid-2" }, [
      chartCard("Tarefas por responsável", U.barChart(respData)),
      chartCard("Tarefas por status", U.barChart(statusData)),
      chartCard("Tarefas por departamento", U.barChart(deptData)),
      chartCard("Concluídas × pendentes",
        el("div", { class: "donut-wrap" }, [
          U.donut(donutSegs, m.progresso + "%", "concluído"),
          U.legend(donutSegs),
        ])),
    ]));

    // minhas tarefas (resumo)
    wrap.appendChild(minhasTarefasSection(true));
    return wrap;
  }

  function progBar(pct) {
    const fill = el("div", { class: "progress-fill" });
    fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    return fill;
  }
  function chartCard(title, node) {
    return el("div", { class: "card chart-card" }, [el("h3", {}, title), node]);
  }

  /* ===================== MINHAS TAREFAS ================================= */
  function minhasTarefasSection(compact) {
    const me = S.session();
    const mine = S.tasks().filter((t) => me && t.responsible_id === me.id)
      .sort((a, b) => order(a) - order(b));
    const card = el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h3", {}, "Minhas tarefas"),
        el("span", { class: "count-pill", text: mine.length + "" }),
      ]),
    ]);
    if (!mine.length) {
      card.appendChild(el("div", { class: "empty" }, "Nenhuma tarefa atribuída a você. Aproveite — ou puxe uma do backlog."));
    } else {
      card.appendChild(taskTable(mine.slice(0, compact ? 6 : mine.length)));
    }
    return card;
  }
  function minhasTarefas() {
    const wrap = el("div", {});
    wrap.appendChild(pageHead("Minhas tarefas", "Tarefas atribuídas a você"));
    wrap.appendChild(minhasTarefasSection(false));
    return wrap;
  }
  function order(t) { // ordena por criticidade de prazo
    const rank = { late: 0, soon: 1, ok: 2, none: 3, done: 4 };
    return rank[S.deadlineStatus(t)];
  }

  /* ===================== DEMANDAS / TAREFAS ============================= */
  const filters = { q: "", responsible: "", department: "", status: "", priority: "" };

  function tarefas() {
    const wrap = el("div", {});
    const addBtn = S.can("createTask") && el("button", { class: "btn brand", onclick: () => taskModal() }, "+ Nova demanda");
    wrap.appendChild(pageHead("Demandas & tarefas", "Cadastro, distribuição e acompanhamento", [addBtn]));

    // barra de filtros
    const bar = el("div", { class: "filter-bar" }, [
      U.input({ class: "control search", placeholder: "Buscar por título…", value: filters.q,
        oninput: (e) => { filters.q = e.target.value; renderList(); } }),
      U.select([{ value: "", label: "Responsável" }].concat(userOpts()), filters.responsible,
        { onchange: (e) => { filters.responsible = e.target.value; renderList(); } }),
      U.select([{ value: "", label: "Departamento" }].concat(deptOpts()), filters.department,
        { onchange: (e) => { filters.department = e.target.value; renderList(); } }),
      U.select([{ value: "", label: "Status" }].concat(statusOpts()), filters.status,
        { onchange: (e) => { filters.status = e.target.value; renderList(); } }),
      U.select([{ value: "", label: "Prioridade" }].concat(prioOpts()), filters.priority,
        { onchange: (e) => { filters.priority = e.target.value; renderList(); } }),
      el("button", { class: "btn ghost small", onclick: () => {
        Object.keys(filters).forEach((k) => (filters[k] = "")); rerender();
      } }, "Limpar"),
    ]);
    wrap.appendChild(bar);

    const listHost = el("div", { class: "card" });
    wrap.appendChild(listHost);
    function renderList() {
      U.clear(listHost);
      const rows = applyFilters(S.tasks());
      listHost.appendChild(el("div", { class: "card-head" }, [
        el("h3", {}, "Resultados"), el("span", { class: "count-pill", text: rows.length + "" }),
      ]));
      listHost.appendChild(rows.length ? taskTable(rows)
        : el("div", { class: "empty" }, "Nenhuma tarefa corresponde aos filtros."));
    }
    renderList();
    return wrap;
  }

  function applyFilters(list) {
    return list.filter((t) => {
      if (filters.q && !t.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
      if (filters.responsible && t.responsible_id !== filters.responsible) return false;
      if (filters.department && t.department !== filters.department) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      return true;
    }).sort((a, b) => order(a) - order(b));
  }

  function taskTable(rows) {
    const table = el("table", { class: "table" }, [
      el("thead", {}, el("tr", {}, [
        th("Tarefa"), th("Responsável"), th("Depto"), th("Prioridade"), th("Status"), th("Prazo"), th(""),
      ])),
    ]);
    const tbody = el("tbody", {});
    rows.forEach((t) => {
      const r = el("tr", { class: "row-click", onclick: () => taskModal(t.id) }, [
        el("td", {}, [
          el("div", { class: "cell-title", text: t.title }),
          t.subtasks && t.subtasks.length
            ? el("div", { class: "cell-sub mono", text: subCount(t) }) : null,
        ]),
        el("td", {}, U.avatar(S.userById(t.responsible_id))),
        el("td", { class: "muted small", text: t.department }),
        el("td", {}, U.priorityBadge(t.priority)),
        el("td", {}, U.statusBadge(t.status)),
        el("td", {}, U.deadlineChip(t)),
        el("td", { class: "row-actions" }, rowMenu(t)),
      ]);
      tbody.appendChild(r);
    });
    table.appendChild(tbody);
    return el("div", { class: "table-scroll" }, [table]);
  }
  function subCount(t) {
    const done = t.subtasks.filter((s) => s.status === "concluida").length;
    return `${done}/${t.subtasks.length} subtarefas`;
  }
  const th = (t) => el("th", {}, t);

  function rowMenu(t) {
    const wrap = el("div", { class: "quick", onclick: (e) => e.stopPropagation() });
    // avanço rápido de status
    const nextMap = { pendente: "andamento", andamento: "revisao", revisao: "concluida" };
    if (nextMap[t.status] && S.can("updateStatus")) {
      wrap.appendChild(el("button", { class: "icon-btn", title: "Avançar status",
        onclick: () => { S.setStatus(t.id, nextMap[t.status]); U.toast("Status atualizado"); rerender(); } }, "→"));
    }
    if (S.can("deleteTask")) {
      wrap.appendChild(el("button", { class: "icon-btn danger", title: "Excluir",
        onclick: () => U.confirmModal("Excluir tarefa", `Remover “${t.title}”? Esta ação não pode ser desfeita.`,
          () => { S.deleteTask(t.id); U.toast("Tarefa excluída"); rerender(); }) }, "🗑")); // eslint-disable-line
    }
    return wrap;
  }

  /* ---- modal de tarefa (criar / editar / detalhe) ---------------------- */
  function taskModal(id) {
    const editing = !!id;
    const t = editing ? S.taskById(id) : {
      title: "", description: "", category: "Operacional", department: "Operacional",
      responsible_id: "", priority: "media", status: "pendente", start_date: S.TODAY, due_date: "",
    };

    const f = {
      title: U.input({ value: t.title, placeholder: "Nome da demanda" }),
      description: U.textarea({ value: t.description, placeholder: "Descrição" }),
      department: U.select(deptOpts(), t.department),
      category: U.input({ value: t.category, placeholder: "Categoria" }),
      responsible: U.select(userOpts(true), t.responsible_id || ""),
      priority: U.select(prioOpts(), t.priority),
      status: U.select(statusOpts(), t.status),
      start: U.input({ type: "date", value: t.start_date || "" }),
      due: U.input({ type: "date", value: t.due_date || "" }),
    };

    const form = el("div", { class: "form-grid" }, [
      U.field("Título", f.title),
      U.field("Descrição", f.description),
      el("div", { class: "form-row" }, [U.field("Departamento", f.department), U.field("Categoria", f.category)]),
      el("div", { class: "form-row" }, [U.field("Responsável", f.responsible), U.field("Prioridade", f.priority)]),
      el("div", { class: "form-row" }, [U.field("Status", f.status), U.field("Data de início", f.start)]),
      U.field("Prazo (data limite)", f.due),
    ]);

    // detalhes extras só na edição: subtarefas, comentários, histórico
    if (editing) {
      form.appendChild(subtasksBlock(t));
      form.appendChild(commentsBlock(t));
      form.appendChild(historyBlock(t));
    }

    const canWrite = S.can(editing ? "editTask" : "createTask");
    const actions = [{ label: "Fechar", kind: "ghost", onClick: (c) => c() }];
    if (canWrite) actions.push({ label: editing ? "Salvar" : "Criar demanda", kind: "brand",
      onClick: (close) => {
        const patch = {
          title: f.title.value.trim(), description: f.description.value.trim(),
          department: f.department.value, category: f.category.value.trim() || "Geral",
          responsible_id: f.responsible.value || null, priority: f.priority.value,
          status: f.status.value, start_date: f.start.value, due_date: f.due.value,
        };
        if (!patch.title) { U.toast("Informe o título da demanda", "warn"); return; }
        if (editing) { S.updateTask(id, patch); U.toast("Tarefa atualizada"); }
        else { S.createTask(patch); U.toast("Demanda criada"); }
        close(); rerender();
      } });

    U.modal(editing ? "Detalhe da tarefa" : "Nova demanda", form, { actions, wide: editing });
  }

  function subtasksBlock(t) {
    const box = el("div", { class: "sub-block" }, [el("h4", {}, "Subtarefas")]);
    const list = el("div", { class: "sub-list" });
    (t.subtasks || []).forEach((s) => {
      const cb = el("input", { type: "checkbox", class: "sub-cb" });
      if (s.status === "concluida") cb.checked = true;
      cb.addEventListener("change", () => { S.toggleSubtask(t.id, s.id); label.classList.toggle("done", cb.checked); });
      const label = el("label", { class: "sub-item" + (s.status === "concluida" ? " done" : "") }, [cb, s.title]);
      list.appendChild(label);
    });
    if (!(t.subtasks || []).length) list.appendChild(el("p", { class: "muted small", text: "Sem subtarefas." }));
    box.appendChild(list);
    // adicionar subtarefa
    const inp = U.input({ placeholder: "Nova subtarefa…", class: "control small" });
    const addRow = el("div", { class: "sub-add" }, [inp,
      el("button", { class: "btn ghost small", onclick: () => {
        const v = inp.value.trim(); if (!v) return;
        t.subtasks = t.subtasks || [];
        t.subtasks.push({ id: "s-" + Date.now(), title: v, status: "pendente" });
        S.persist(); inp.value = ""; U.toast("Subtarefa adicionada");
        // re-render bloco
        const parent = box.parentNode; parent.replaceChild(subtasksBlock(t), box);
      } }, "Adicionar")]);
    box.appendChild(addRow);
    return box;
  }

  function commentsBlock(t) {
    const box = el("div", { class: "sub-block" }, [el("h4", {}, "Comentários")]);
    const list = el("div", { class: "comment-list" });
    S.commentsFor(t.id).forEach((c) => {
      list.appendChild(el("div", { class: "comment" }, [
        U.avatar(S.userById(c.user_id), "sm"),
        el("div", {}, [
          el("div", { class: "comment-meta" }, [
            el("strong", { text: S.userName(c.user_id) }),
            el("span", { class: "muted small", text: U.fmtDateTime(c.created_at) }),
          ]),
          el("div", { class: "comment-body", text: c.comment }),
        ]),
      ]));
    });
    if (!S.commentsFor(t.id).length) list.appendChild(el("p", { class: "muted small", text: "Nenhum comentário ainda." }));
    box.appendChild(list);
    const inp = U.input({ placeholder: "Escreva um comentário…" });
    box.appendChild(el("div", { class: "sub-add" }, [inp,
      el("button", { class: "btn ghost small", onclick: () => {
        const v = inp.value.trim(); if (!v) return;
        S.addComment(t.id, v); inp.value = "";
        const parent = box.parentNode; parent.replaceChild(commentsBlock(t), box);
      } }, "Enviar")]));
    return box;
  }

  function historyBlock(t) {
    const box = el("div", { class: "sub-block" }, [el("h4", {}, "Histórico")]);
    const list = el("ul", { class: "history" });
    S.historyFor(t.id).forEach((h) => {
      const who = S.userName(h.user_id);
      let msg = `${who} ${h.action}`;
      if (h.old_value || h.new_value) msg += ` — de “${h.old_value || "—"}” para “${h.new_value || "—"}”`;
      list.appendChild(el("li", {}, [
        el("span", { class: "hist-dot" }),
        el("span", { class: "hist-msg", text: msg }),
        el("span", { class: "muted small", text: U.fmtDateTime(h.created_at) }),
      ]));
    });
    if (!S.historyFor(t.id).length) list.appendChild(el("li", { class: "muted small", text: "Sem registros." }));
    box.appendChild(list);
    return box;
  }

  /* ===================== KANBAN ======================================== */
  function kanban() {
    const wrap = el("div", {});
    wrap.appendChild(pageHead("Kanban", "Arraste os cards para atualizar o status"));
    const cols = ["pendente", "andamento", "revisao", "bloqueada", "concluida", "cancelada"];
    const board = el("div", { class: "kanban" });
    cols.forEach((status) => {
      const items = S.tasks().filter((t) => t.status === status);
      const col = el("div", { class: "kcol", "data-status": status }, [
        el("div", { class: "kcol-head" }, [
          el("span", { class: "kcol-dot s-" + status }),
          el("span", { class: "kcol-title", text: S.STATUS_LABEL[status] }),
          el("span", { class: "count-pill", text: items.length + "" }),
        ]),
      ]);
      const drop = el("div", { class: "kcol-body" });
      items.forEach((t) => drop.appendChild(kanbanCard(t)));
      // DnD
      drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag-over"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
      drop.addEventListener("drop", (e) => {
        e.preventDefault(); drop.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/plain");
        const task = S.taskById(id);
        if (task && task.status !== status) {
          if (!S.can("updateStatus")) { U.toast("Sem permissão para alterar status", "warn"); return; }
          S.setStatus(id, status); U.toast(`Movido para ${S.STATUS_LABEL[status]}`); rerender();
        }
      });
      col.appendChild(drop);
      board.appendChild(col);
    });
    wrap.appendChild(el("div", { class: "kanban-scroll" }, [board]));
    return wrap;
  }
  function kanbanCard(t) {
    const card = el("div", { class: "kcard", draggable: "true", onclick: () => taskModal(t.id) }, [
      el("div", { class: "kcard-top" }, [U.priorityBadge(t.priority), U.avatar(S.userById(t.responsible_id), "sm")]),
      el("div", { class: "kcard-title", text: t.title }),
      el("div", { class: "kcard-foot" }, [U.deadlineChip(t)]),
    ]);
    card.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", t.id); card.classList.add("dragging"); });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    return card;
  }

  /* ===================== FLUXOGRAMA ==================================== */
  function fluxograma() {
    const wrap = el("div", {});
    wrap.appendChild(pageHead("Fluxograma de distribuição", "Demanda → Atividade → Responsável → Status → Prazo → Conclusão"));

    // trilho do fluxo
    const stages = ["Demanda", "Atividade", "Responsável", "Status", "Prazo", "Conclusão"];
    wrap.appendChild(el("div", { class: "flow-rail" },
      stages.map((s, i) => el("div", { class: "flow-node" }, [
        el("span", { class: "flow-idx mono", text: String(i + 1).padStart(2, "0") }),
        el("span", { class: "flow-name", text: s }),
      ]))));

    // cards por atividade, mostrando o caminho
    const grid = el("div", { class: "flow-grid" });
    S.tasks().sort((a, b) => order(a) - order(b)).forEach((t) => {
      grid.appendChild(el("div", { class: "flow-card", onclick: () => taskModal(t.id) }, [
        el("div", { class: "flow-card-title", text: t.title }),
        el("div", { class: "flow-steps" }, [
          flowStep("Resp.", U.avatar(S.userById(t.responsible_id), "sm")),
          flowSep(),
          flowStep("Status", U.statusBadge(t.status)),
          flowSep(),
          flowStep("Prazo", U.deadlineChip(t)),
        ]),
      ]));
    });
    wrap.appendChild(grid);
    return wrap;
  }
  function flowStep(label, node) {
    return el("div", { class: "flow-step" }, [el("span", { class: "flow-step-label", text: label }), node]);
  }
  function flowSep() { return el("span", { class: "flow-arrow", text: "→" }); }

  /* ===================== EQUIPE ======================================== */
  function equipe() {
    const wrap = el("div", {});
    const add = S.can("manageUsers") && el("button", { class: "btn brand", onclick: () => userModal() }, "+ Novo usuário");
    wrap.appendChild(pageHead("Equipe", "Cadastro de responsáveis e permissões", [add]));
    const grid = el("div", { class: "team-grid" });
    S.activeUsers().forEach((u) => {
      const p = S.progressByUser().find((x) => x.id === u.id) || { total: 0, done: 0, pct: 0 };
      grid.appendChild(el("div", { class: "card team-card" }, [
        el("div", { class: "team-top" }, [U.avatar(u, "lg"),
          el("div", {}, [
            el("strong", { text: u.name }),
            el("div", { class: "muted small", text: u.email }),
          ])]),
        el("div", { class: "team-meta" }, [
          el("span", { class: "badge role r-" + u.role, text: S.ROLE_LABEL[u.role] }),
          el("span", { class: "muted small", text: u.department }),
        ]),
        el("div", { class: "team-prog" }, [
          el("div", { class: "progress sm" }, [progBar(p.pct)]),
          el("span", { class: "muted small mono", text: `${p.done}/${p.total} · ${p.pct}%` }),
        ]),
        S.can("manageUsers") && el("div", { class: "team-actions" }, [
          el("button", { class: "btn ghost small", onclick: () => userModal(u.id) }, "Editar"),
          el("button", { class: "btn ghost small danger", onclick: () =>
            U.confirmModal("Desativar usuário", `Desativar ${u.name}? As tarefas e o histórico são preservados.`,
              () => { S.deleteUser(u.id); U.toast("Usuário desativado"); rerender(); }) }, "Desativar"),
        ]),
      ]));
    });
    wrap.appendChild(grid);
    return wrap;
  }
  function userModal(id) {
    const editing = !!id;
    const u = editing ? S.userById(id) : { name: "", email: "", role: "colaborador", department: "Operacional" };
    const f = {
      name: U.input({ value: u.name, placeholder: "Nome completo" }),
      email: U.input({ value: u.email, placeholder: "email@empresa.com", type: "email" }),
      role: U.select(S.ROLES.map((r) => ({ value: r, label: S.ROLE_LABEL[r] })), u.role),
      dept: U.select(deptOpts(), u.department),
    };
    const form = el("div", { class: "form-grid" }, [
      U.field("Nome", f.name), U.field("E-mail", f.email),
      el("div", { class: "form-row" }, [U.field("Permissão", f.role), U.field("Departamento", f.dept)]),
    ]);
    U.modal(editing ? "Editar usuário" : "Novo usuário", form, {
      actions: [
        { label: "Fechar", kind: "ghost", onClick: (c) => c() },
        { label: editing ? "Salvar" : "Criar", kind: "brand", onClick: (close) => {
          const data = { name: f.name.value.trim(), email: f.email.value.trim(),
            role: f.role.value, department: f.dept.value };
          if (!data.name) { U.toast("Informe o nome", "warn"); return; }
          if (editing) S.updateUser(id, data); else S.createUser(data);
          U.toast("Usuário salvo"); close(); rerender();
        } },
      ],
    });
  }

  /* ===================== DIRETORIA ===================================== */
  function diretoria() {
    const wrap = el("div", {});
    const add = S.can("editTask") && el("button", { class: "btn brand", onclick: () => dirModal() }, "+ Nova linha");
    wrap.appendChild(pageHead("Diretoria", "Painel de responsabilidades estratégicas", [add]));
    const table = el("table", { class: "table" }, [
      el("thead", {}, el("tr", {}, [th("Área"), th("Tarefa"), th("Responsável"), th("Status"), th("")])),
    ]);
    const tb = el("tbody", {});
    S.directory().forEach((r) => {
      tb.appendChild(el("tr", {}, [
        el("td", { class: "cell-title", text: r.area }),
        el("td", { text: r.task }),
        el("td", {}, el("span", { class: "resp-tag", text: r.responsible })),
        el("td", {}, U.statusBadge(r.status)),
        el("td", { class: "row-actions" }, S.can("editTask") ? el("div", { class: "quick" }, [
          el("button", { class: "icon-btn", title: "Editar", onclick: () => dirModal(r) }, "✎"),
          el("button", { class: "icon-btn danger", title: "Excluir", onclick: () =>
            U.confirmModal("Excluir linha", `Remover “${r.task}”?`,
              () => { S.deleteDirectory(r.id); U.toast("Linha removida"); rerender(); }) }, "🗑"), // eslint-disable-line
        ]) : null),
      ]));
    });
    table.appendChild(tb);
    wrap.appendChild(el("div", { class: "card" }, [el("div", { class: "table-scroll" }, [table])]));
    return wrap;
  }
  function dirModal(row) {
    const editing = !!row;
    row = row || { area: "", task: "", responsible: "Todos", status: "pendente" };
    const respChoices = ["Miqueias", "Misael", "Keven", "Todos", "A definir"].map((n) => ({ value: n, label: n }));
    const f = {
      area: U.input({ value: row.area, placeholder: "Área" }),
      task: U.input({ value: row.task, placeholder: "Tarefa" }),
      resp: U.select(respChoices, row.responsible),
      status: U.select(statusOpts(), row.status),
    };
    U.modal(editing ? "Editar linha" : "Nova linha", el("div", { class: "form-grid" }, [
      U.field("Área", f.area), U.field("Tarefa", f.task),
      el("div", { class: "form-row" }, [U.field("Responsável", f.resp), U.field("Status", f.status)]),
    ]), {
      actions: [
        { label: "Fechar", kind: "ghost", onClick: (c) => c() },
        { label: "Salvar", kind: "brand", onClick: (close) => {
          const data = { id: editing ? row.id : undefined, area: f.area.value.trim(),
            task: f.task.value.trim(), responsible: f.resp.value, status: f.status.value };
          if (!data.area || !data.task) { U.toast("Preencha área e tarefa", "warn"); return; }
          S.upsertDirectory(data); U.toast("Salvo"); close(); rerender();
        } },
      ],
    });
  }

  /* ===================== KPIs ========================================== */
  function kpis() {
    const m = S.metrics();
    const wrap = el("div", {});
    wrap.appendChild(pageHead("KPIs", "Indicadores operacionais"));
    wrap.appendChild(el("div", { class: "stats-grid" }, [
      statCard("Progresso geral", m.progresso + "%", "tone-ok"),
      statCard("SLA no prazo", m.sla + "%", m.sla >= 80 ? "tone-ok" : "tone-warn"),
      statCard("Atrasadas", m.atrasada, m.atrasada ? "tone-danger" : ""),
      statCard("Ativas", m.ativos, "tone-info"),
    ]));
    // produtividade por responsável
    const card = el("div", { class: "card" }, [el("div", { class: "card-head" }, [el("h3", {}, "Produtividade por responsável")])]);
    S.progressByUser().forEach((p) => {
      card.appendChild(el("div", { class: "kpi-row" }, [
        el("span", { class: "kpi-name", text: p.name }),
        el("div", { class: "progress sm" }, [progBar(p.pct)]),
        el("span", { class: "mono muted small", text: `${p.done}/${p.total} · ${p.pct}%` }),
      ]));
    });
    wrap.appendChild(card);
    return wrap;
  }

  /* ===================== SLA =========================================== */
  function sla() {
    const m = S.metrics();
    const wrap = el("div", {});
    wrap.appendChild(pageHead("SLA", "Percentual de tarefas dentro e fora do prazo"));
    const comPrazo = S.tasks().filter((t) => t.due_date && t.status !== "cancelada");
    const late = comPrazo.filter((t) => S.deadlineStatus(t) === "late");
    const segs = [
      { label: "No prazo", value: comPrazo.length - late.length, color: U.COLORS.status.concluida },
      { label: "Fora do prazo", value: late.length, color: U.COLORS.status.bloqueada },
    ];
    wrap.appendChild(el("div", { class: "grid-2" }, [
      chartCard("SLA geral", el("div", { class: "donut-wrap" }, [
        U.donut(segs, m.sla + "%", "no prazo"), U.legend(segs),
      ])),
      (function () {
        const c = el("div", { class: "card" }, [el("h3", {}, "Tarefas fora do prazo")]);
        if (!late.length) c.appendChild(el("div", { class: "empty" }, "Tudo dentro do prazo. 🟢"));
        else c.appendChild(taskTable(late));
        return c;
      })(),
    ]));
    return wrap;
  }

  /* ===================== RELATÓRIOS ==================================== */
  function relatorios() {
    const m = S.metrics();
    const wrap = el("div", {});
    wrap.appendChild(pageHead("Relatórios", "Resumo executivo exportável"));
    wrap.appendChild(el("div", { class: "stats-grid" }, [
      statCard("Total", m.total), statCard("Concluídas", m.concluida, "tone-ok"),
      statCard("Pendentes", m.pendente + m.andamento + m.revisao, "tone-neutral"),
      statCard("Atrasadas", m.atrasada, m.atrasada ? "tone-danger" : ""),
    ]));
    const card = el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [el("h3", {}, "Todas as tarefas"),
        el("button", { class: "btn ghost small", onclick: exportCSV }, "Exportar CSV")]),
      taskTable(S.tasks()),
    ]);
    wrap.appendChild(card);
    return wrap;
  }
  function exportCSV() {
    const head = ["Titulo", "Responsavel", "Departamento", "Prioridade", "Status", "Inicio", "Prazo"];
    const rows = S.tasks().map((t) => [t.title, S.userName(t.responsible_id), t.department,
      S.PRIORITY_LABEL[t.priority], S.STATUS_LABEL[t.status], t.start_date, t.due_date]
      .map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
    const csv = [head.join(","), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "mk-solutions-tarefas.csv" });
    document.body.appendChild(a); a.click(); a.remove();
    U.toast("CSV exportado");
  }

  /* ===================== NOTIFICAÇÕES ================================== */
  function notificacoes() {
    const wrap = el("div", {});
    wrap.appendChild(pageHead("Notificações", "Eventos das suas tarefas", [
      el("button", { class: "btn ghost small", onclick: () => { S.markAllRead(); U.toast("Marcadas como lidas"); rerender(); } },
        "Marcar todas como lidas"),
    ]));
    const me = S.session();
    const mine = S.notifications().filter((n) => !me || n.user_id === me.id);
    const card = el("div", { class: "card" });
    if (!mine.length) card.appendChild(el("div", { class: "empty" }, "Sem notificações."));
    mine.forEach((n) => {
      card.appendChild(el("div", { class: "notif" + (n.read ? "" : " unread"), onclick: () => n.task_id && taskModal(n.task_id) }, [
        el("span", { class: "notif-dot t-" + n.type }),
        el("div", {}, [
          el("div", { class: "notif-msg", text: n.message }),
          el("span", { class: "muted small", text: U.fmtDateTime(n.created_at) }),
        ]),
      ]));
    });
    wrap.appendChild(card);
    return wrap;
  }

  /* ===================== CONFIGURAÇÕES ================================= */
  function config() {
    const wrap = el("div", {});
    wrap.appendChild(pageHead("Configurações", "Preferências e dados do sistema"));
    wrap.appendChild(el("div", { class: "card" }, [
      el("h3", {}, "Dados de demonstração"),
      el("p", { class: "muted", text: "O sistema roda com dados salvos localmente no navegador (localStorage). "
        + "Você pode restaurar os dados iniciais do PRD a qualquer momento." }),
      el("button", { class: "btn danger", onclick: () =>
        U.confirmModal("Restaurar dados", "Isto apaga suas alterações e recarrega os dados iniciais. Continuar?",
          () => { S.reset(); U.toast("Dados restaurados"); window.location.hash = "#/dashboard"; rerender(); }) },
        "Restaurar dados iniciais"),
    ]));
    wrap.appendChild(el("div", { class: "card" }, [
      el("h3", {}, "Sobre esta versão"),
      el("p", { class: "muted", html: "MK-Solutions · <strong>v1</strong> — Layout, Dashboard, Tarefas, Kanban, "
        + "Fluxograma, Diretoria, Equipe, KPIs, SLA. Próximas etapas: autenticação real, anexos, e integração de backend." }),
    ]));
    return wrap;
  }

  window.MK.views = {
    dashboard, minhasTarefas, tarefas, kanban, fluxograma, equipe,
    kpis, sla, diretoria, relatorios, notificacoes, config, taskModal,
  };
})();
