/* =========================================================================
   MK-SOLUTIONS · Aplicação (router + shell + sessão)
   ========================================================================= */
(function () {
  "use strict";
  const S = window.MK.store, U = window.MK.ui, V = window.MK.views, el = U.el;

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "◧", view: "dashboard" },
    { id: "minhas", label: "Minhas Tarefas", icon: "☑", view: "minhasTarefas" },
    { id: "demandas", label: "Demandas", icon: "▤", view: "tarefas" },
    { id: "fluxograma", label: "Fluxograma", icon: "⇄", view: "fluxograma" },
    { id: "kanban", label: "Kanban", icon: "▦", view: "kanban" },
    { id: "equipe", label: "Equipe", icon: "◎", view: "equipe" },
    { id: "kpis", label: "KPIs", icon: "◔", view: "kpis" },
    { id: "sla", label: "SLA", icon: "◕", view: "sla" },
    { id: "diretoria", label: "Diretoria", icon: "★", view: "diretoria" },
    { id: "relatorios", label: "Relatórios", icon: "▥", view: "relatorios" },
    { id: "notificacoes", label: "Notificações", icon: "◈", view: "notificacoes" },
    { id: "config", label: "Configurações", icon: "⚙", view: "config" },
  ];

  const root = () => document.getElementById("app");

  /* ---- LOGIN ----------------------------------------------------------- */
  function renderLogin() {
    const host = U.clear(root());
    host.className = "auth-screen";
    const picker = el("div", { class: "auth-users" });
    S.activeUsers().forEach((u) => {
      picker.appendChild(el("button", { class: "auth-user", onclick: () => { S.login(u.id); go("#/dashboard"); } }, [
        U.avatar(u, "lg"),
        el("div", {}, [
          el("strong", { text: u.name }),
          el("span", { class: "muted small", text: S.ROLE_LABEL[u.role] + " · " + u.department }),
        ]),
      ]));
    });
    host.appendChild(el("div", { class: "auth-box" }, [
      el("div", { class: "mk-login-logo", role: "img", "aria-label": "MK-Solutions" }),
      el("div", { class: "auth-sep", text: "Entrar como" }),
      picker,
      el("p", { class: "auth-note", text: "v1 · seleção de perfil para demonstração. Autenticação real entra em etapa posterior." }),
    ]));
  }

  /* ---- SHELL ----------------------------------------------------------- */
  function renderShell() {
    const host = U.clear(root());
    host.className = "shell";

    const sidebar = el("aside", { class: "sidebar", id: "sidebar" }, [
      el("div", { class: "sb-brand" }, [
        el("div", { class: "mk-mark" }),
        el("div", { class: "brand-text" }, [
          el("strong", { text: "MK-Solutions" }),
          el("span", { class: "muted xs", text: "Painel operacional" }),
        ]),
      ]),
      el("nav", { class: "sb-nav", id: "sbNav" }),
      el("div", { class: "sb-foot" }, [profileChip()]),
    ]);

    const main = el("div", { class: "main" }, [
      el("header", { class: "topbar" }, [
        el("button", { class: "icon-btn menu-toggle", "aria-label": "Menu", onclick: toggleSidebar, html: "☰" }),
        el("div", { class: "crumb", id: "crumb" }),
        el("div", { class: "topbar-right" }, [notifBell(), profileMini()]),
      ]),
      el("main", { class: "content", id: "content" }),
    ]);

    const scrim = el("div", { class: "sb-scrim", onclick: toggleSidebar });
    host.appendChild(sidebar); host.appendChild(main); host.appendChild(scrim);
    buildNav();
  }

  function buildNav() {
    const nav = document.getElementById("sbNav"); if (!nav) return;
    U.clear(nav);
    const current = route();
    NAV.forEach((item) => {
      const badge = item.id === "notificacoes" && S.unreadCount()
        ? el("span", { class: "nav-badge", text: S.unreadCount() + "" }) : null;
      nav.appendChild(el("a", { class: "nav-item" + (item.id === current ? " active" : ""),
        href: "#/" + item.id, onclick: () => closeSidebarMobile() }, [
        el("span", { class: "nav-icon", text: item.icon }),
        el("span", { class: "nav-label", text: item.label }),
        badge,
      ]));
    });
  }

  function profileChip() {
    const u = S.session();
    return el("div", { class: "profile-chip" }, [
      U.avatar(u), el("div", { class: "profile-info" }, [
        el("strong", { text: u ? u.name : "—" }),
        el("span", { class: "muted xs", text: u ? S.ROLE_LABEL[u.role] : "" }),
      ]),
      el("button", { class: "icon-btn", title: "Sair", onclick: () => { S.logout(); go("#/login"); }, html: "⏻" }),
    ]);
  }
  function profileMini() {
    const u = S.session();
    return el("div", { class: "profile-mini", title: u ? u.name : "" }, [U.avatar(u)]);
  }
  function notifBell() {
    const n = S.unreadCount();
    return el("a", { class: "icon-btn bell", href: "#/notificacoes", title: "Notificações" }, [
      "◈", n ? el("span", { class: "bell-badge", text: n > 9 ? "9+" : n + "" }) : null,
    ]);
  }

  /* ---- sidebar mobile -------------------------------------------------- */
  function toggleSidebar() { document.querySelector(".shell").classList.toggle("sb-open"); }
  function closeSidebarMobile() {
    const sh = document.querySelector(".shell");
    if (sh && window.innerWidth <= 900) sh.classList.remove("sb-open");
  }

  /* ---- ROUTER ---------------------------------------------------------- */
  function route() {
    const h = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0] || "dashboard";
    return h;
  }
  function go(hash) { window.location.hash = hash; }

  function render() {
    if (!S.session()) { renderLogin(); return; }
    if (!document.querySelector(".shell")) renderShell();
    buildNav();

    const r = route();
    const item = NAV.find((x) => x.id === r) || NAV[0];
    const content = document.getElementById("content");
    const crumb = document.getElementById("crumb");
    if (crumb) crumb.textContent = item.label;
    if (content) {
      U.clear(content);
      try {
        content.appendChild(V[item.view]());
      } catch (e) {
        console.error(e);
        content.appendChild(el("div", { class: "empty" }, "Erro ao carregar a tela. Veja o console."));
      }
      content.scrollTop = 0;
    }
  }

  window.MK.app = { render, go, NAV };

  /* ---- boot ------------------------------------------------------------ */
  window.addEventListener("hashchange", () => {
    if (route() === "login") { S.logout(); }
    render();
  });
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.location.hash) window.location.hash = S.session() ? "#/dashboard" : "#/login";
    render();
  });
})();
