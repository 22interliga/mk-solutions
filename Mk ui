/* =========================================================================
   MK-SOLUTIONS · Componentes de interface (ui)
   Helpers reutilizáveis: DOM, badges/chips, modal, toast, gráficos SVG.
   ========================================================================= */
(function () {
  "use strict";
  const S = window.MK.store;

  /* ---- DOM ------------------------------------------------------------- */
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : children != null ? [children] : []).forEach((c) => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  /* ---- formatação ------------------------------------------------------ */
  function fmtDate(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const dt = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(dt.getDate())}/${p(dt.getMonth() + 1)} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
  }
  function relPrazo(task) {
    const st = S.deadlineStatus(task);
    if (st === "none") return "Sem prazo";
    if (st === "done") return "—";
    const d = S.daysUntil(task.due_date);
    if (d < 0) return `Atrasada ${Math.abs(d)}d`;
    if (d === 0) return "Vence hoje";
    if (d === 1) return "Vence amanhã";
    return `Faltam ${d}d`;
  }

  /* ---- badges / chips -------------------------------------------------- */
  const DEADLINE_META = {
    ok: { dot: "🟢", cls: "is-ok", label: "No prazo" },
    soon: { dot: "🟡", cls: "is-soon", label: "Prazo próximo" },
    late: { dot: "🔴", cls: "is-late", label: "Atrasada" },
    none: { dot: "⚫", cls: "is-none", label: "Sem prazo" },
    done: { dot: "✔", cls: "is-done", label: "Concluída" },
  };
  function deadlineChip(task) {
    const m = DEADLINE_META[S.deadlineStatus(task)];
    return el("span", { class: `chip deadline ${m.cls}`, title: m.label }, [
      el("span", { class: "chip-dot", text: m.dot }), relPrazo(task),
    ]);
  }
  function statusBadge(status) {
    return el("span", { class: `badge status s-${status}` }, S.STATUS_LABEL[status] || status);
  }
  function priorityBadge(p) {
    return el("span", { class: `badge prio p-${p}` }, S.PRIORITY_LABEL[p] || p);
  }
  function avatar(user, size) {
    const name = user ? user.name : "—";
    const av = el("span", { class: "avatar" + (size ? " " + size : ""), title: name },
      user ? (user.avatar || S.initials(name)).toUpperCase() : "—");
    av.style.setProperty("--seed", hashHue(name));
    return av;
  }
  function hashHue(str) {
    let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  /* ---- toast ----------------------------------------------------------- */
  let toastWrap;
  function toast(msg, kind) {
    if (!toastWrap) { toastWrap = el("div", { class: "toast-wrap" }); document.body.appendChild(toastWrap); }
    const t = el("div", { class: "toast " + (kind || "") }, msg);
    toastWrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 250); }, 2600);
  }

  /* ---- modal ----------------------------------------------------------- */
  function modal(title, bodyNode, opts) {
    opts = opts || {};
    const overlay = el("div", { class: "modal-overlay" });
    const closeBtn = el("button", { class: "icon-btn modal-x", "aria-label": "Fechar", html: "&times;" });
    const foot = el("div", { class: "modal-foot" });
    const box = el("div", { class: "modal" + (opts.wide ? " wide" : "") }, [
      el("div", { class: "modal-head" }, [el("h3", {}, title), closeBtn]),
      el("div", { class: "modal-body" }, [bodyNode]),
      foot,
    ]);
    (opts.actions || []).forEach((a) => {
      foot.appendChild(el("button", { class: "btn " + (a.kind || "ghost"),
        onclick: () => a.onClick && a.onClick(close) }, a.label));
    });
    function close() { overlay.classList.remove("show"); setTimeout(() => overlay.remove(), 180); }
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    return { close, box };
  }
  function confirmModal(title, message, onYes) {
    modal(title, el("p", { class: "muted", text: message }), {
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: (c) => c() },
        { label: "Confirmar", kind: "danger", onClick: (c) => { onYes(); c(); } },
      ],
    });
  }

  /* ---- form helpers ---------------------------------------------------- */
  function field(label, control) {
    return el("label", { class: "field" }, [el("span", { class: "field-label", text: label }), control]);
  }
  function input(attrs) { return el("input", Object.assign({ class: "control" }, attrs)); }
  function textarea(attrs) { return el("textarea", Object.assign({ class: "control", rows: 3 }, attrs)); }
  function select(options, value, attrs) {
    const s = el("select", Object.assign({ class: "control" }, attrs));
    options.forEach((o) => {
      const opt = el("option", { value: o.value }, o.label);
      if (String(o.value) === String(value)) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }

  /* ---- gráficos SVG (sem dependências) --------------------------------- */
  const NS = "http://www.w3.org/2000/svg";
  function svg(w, h) {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("class", "chart"); return s;
  }
  function svgEl(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]); return e;
  }

  // barras horizontais: data = [{label,value,color?}]
  function barChart(data, opts) {
    opts = opts || {};
    const W = 320, rowH = 34, pad = 8, labelW = 108, max = Math.max(1, ...data.map((d) => d.value));
    const H = Math.max(rowH, data.length * rowH) + pad;
    const s = svg(W, H);
    data.forEach((d, i) => {
      const y = i * rowH + pad;
      const bw = Math.round(((W - labelW - 40) * d.value) / max);
      s.appendChild(svgEl("text", { x: 0, y: y + 20, class: "c-label" })).textContent = d.label;
      s.appendChild(svgEl("rect", { x: labelW, y: y + 6, width: W - labelW - 40, height: 16, rx: 8, class: "c-track" }));
      const bar = svgEl("rect", { x: labelW, y: y + 6, width: Math.max(bw, d.value ? 6 : 0), height: 16, rx: 8 });
      bar.setAttribute("fill", d.color || "var(--brand)");
      s.appendChild(bar);
      const val = svgEl("text", { x: W - 4, y: y + 20, class: "c-value", "text-anchor": "end" });
      val.textContent = d.value; s.appendChild(val);
    });
    return s;
  }

  // rosca: segments = [{value,color,label}]; center = texto grande
  function donut(segments, centerText, centerSub) {
    const total = segments.reduce((a, b) => a + b.value, 0) || 1;
    const size = 180, r = 70, c = size / 2, circ = 2 * Math.PI * r;
    const s = svg(size, size);
    s.appendChild(svgEl("circle", { cx: c, cy: c, r, class: "c-track", fill: "none", "stroke-width": 20 }));
    let off = 0;
    segments.forEach((seg) => {
      if (!seg.value) return;
      const len = (seg.value / total) * circ;
      const ring = svgEl("circle", { cx: c, cy: c, r, fill: "none", "stroke-width": 20,
        "stroke-dasharray": `${len} ${circ - len}`, "stroke-dashoffset": -off,
        transform: `rotate(-90 ${c} ${c})` });
      ring.setAttribute("stroke", seg.color);
      s.appendChild(ring); off += len;
    });
    const big = svgEl("text", { x: c, y: c - 2, class: "c-center", "text-anchor": "middle" });
    big.textContent = centerText; s.appendChild(big);
    if (centerSub) {
      const sub = svgEl("text", { x: c, y: c + 18, class: "c-center-sub", "text-anchor": "middle" });
      sub.textContent = centerSub; s.appendChild(sub);
    }
    return s;
  }

  function legend(items) {
    return el("div", { class: "legend" }, items.map((it) => {
      const dot = el("span", { class: "legend-dot" });
      dot.style.background = it.color;
      return el("span", { class: "legend-item" }, [dot, `${it.label} · ${it.value}`]);
    }));
  }

  /* ---- cores por status/prioridade (para gráficos) --------------------- */
  const COLORS = {
    status: { pendente: "#64748B", andamento: "#2563EB", revisao: "#F59E0B",
      bloqueada: "#DC2626", concluida: "#16A34A", cancelada: "#94A3B8" },
    prio: { baixa: "#64748B", media: "#2563EB", alta: "#F59E0B", critica: "#7C3AED" },
    brand: "#0D9488",
  };

  window.MK.ui = {
    el, clear, fmtDate, fmtDateTime, relPrazo,
    deadlineChip, statusBadge, priorityBadge, avatar, DEADLINE_META,
    toast, modal, confirmModal, field, input, textarea, select,
    barChart, donut, legend, COLORS,
  };
})();
