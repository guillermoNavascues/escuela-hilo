(() => {
  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const SUITS = [{ s: "♠", red: false }, { s: "♥", red: true }, { s: "♦", red: true }, { s: "♣", red: false }];
  const hilo = r => ("23456".includes(r) && r.length === 1) ? 1 : (r === "7" || r === "8" || r === "9") ? 0 : -1;
  const fmtV = v => v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0";
  const fmtS = ms => (ms / 1000).toFixed(ms < 10000 ? 2 : 1).replace(".", ",") + " s";

  const cardNum = r => r === "A" ? 11 : ["10", "J", "Q", "K"].includes(r) ? 10 : parseInt(r, 10);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function newDeck() {
    const d = [];
    for (const su of SUITS) for (const r of RANKS) d.push({ r, s: su.s, red: su.red, v: hilo(r), n: cardNum(r) });
    return shuffle(d);
  }
  const parseNum = s => { const v = parseInt(String(s).replace("−", "-").replace(/\s/g, ""), 10); return isFinite(v) ? v : null; };
  function cardEl(c, mini = false) {
    const el = document.createElement("div");
    el.className = "card" + (c.red ? " red" : "") + (mini ? " mini" : " deal");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", c.r + " de " + ({ "♠": "picas", "♥": "corazones", "♦": "diamantes", "♣": "tréboles" })[c.s]);
    el.innerHTML = `<div class="c tl"><span>${c.r}</span><span>${c.s}</span></div>${mini ? "" : cardArt(c)}<div class="pip">${c.s}</div><div class="c br"><span>${c.r}</span><span>${c.s}</span></div>`;
    return el;
  }
  // Posiciones de los palos en una carta real: columna 0-2, fila 0-6 (la mitad inferior va girada)
  const PIPS = {
    2: [[1, 0], [1, 6]],
    3: [[1, 0], [1, 3], [1, 6]],
    4: [[0, 0], [2, 0], [0, 6], [2, 6]],
    5: [[0, 0], [2, 0], [1, 3], [0, 6], [2, 6]],
    6: [[0, 0], [2, 0], [0, 3], [2, 3], [0, 6], [2, 6]],
    7: [[0, 0], [2, 0], [1, 1.5], [0, 3], [2, 3], [0, 6], [2, 6]],
    8: [[0, 0], [2, 0], [1, 1.5], [0, 3], [2, 3], [1, 4.5], [0, 6], [2, 6]],
    9: [[0, 0], [2, 0], [0, 2], [2, 2], [1, 3], [0, 4], [2, 4], [0, 6], [2, 6]],
    10: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2], [0, 4], [2, 4], [1, 5], [0, 6], [2, 6]]
  };
  function cardArt(c) {
    if (c.r === "A") return `<div class="art"><div class="ace">${c.s}</div></div>`;
    if ("JQK".includes(c.r)) return `<div class="art"><div class="face"><b>${c.r}</b><i>${c.s}</i></div></div>`;
    return `<div class="art pips">${PIPS[c.r].map(([x, y]) => `<span class="${y > 3 ? "flip" : ""}" style="left:${28 + x * 22}%;top:${17 + y * 11}%">${c.s}</span>`).join("")}</div>`;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem("hilo:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("hilo:" + k, JSON.stringify(v)); } catch {} renderNav(); }
  };

  // ---------- Navegación ----------
  const views = ["teoria", "estrategia", "valores", "baraja", "real", "desv", "mesa"];
  let current = "teoria";
  function show(name) {
    if (!views.includes(name)) name = "teoria";
    current = name;
    for (const v of views) {
      $("#view-" + v).hidden = v !== name;
      $("#tab-" + v).setAttribute("aria-selected", String(v === name));
    }
    if (name !== "valores") V.abort();
    if (name !== "baraja") D.abort();
    if (name === "teoria") renderPhases();
    renderNav();
    try { const t = $("#tab-" + name), nav = t.parentElement; nav.scrollTo({ left: t.offsetLeft - nav.clientWidth / 2 + t.clientWidth / 2 }); } catch {}
    try { history.replaceState(null, "", "#" + name); } catch {}
  }
  document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => { show(b.dataset.view); window.scrollTo({ top: 0 }); }));
  document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (g) { show(g.dataset.goto); window.scrollTo({ top: 0 }); } });

  // Progreso en la barra lateral: un punto por módulo y 7 segmentos, uno por fase
  function renderNav() {
    const done = [estrategiaPassed(), valoresPassed(), barajaPassed(), gruposPassed(), realPassed(), desvPassed(), mesaPassed()];
    const n = done.filter(Boolean).length;
    $("#prog-num").textContent = `${n} / 7 fases`;
    $("#prog-bar").innerHTML = done.map(d => `<span class="${d ? "on" : ""}"></span>`).join("");
    document.querySelectorAll("nav.tabs [data-phase]").forEach(b => {
      const ph = b.dataset.phase.split(",").map(p => done[+p - 1]);
      b.dataset.done = ph.every(Boolean) ? "true" : ph.some(Boolean) ? "half" : "false";
    });
  }

  // Portada: las 52 cartas coloreadas por su valor Hi-Lo
  $("#deckgrid").innerHTML = SUITS.map(() => RANKS.map((r, i) => {
    const v = hilo(r);
    return `<span class="dc ${v > 0 ? "plus" : v < 0 ? "minus" : "zero"}" style="animation-delay:${i * 25}ms">${r}</span>`;
  }).join("")).join("");

  // ---------- Teoría: calculadora y gráfico ----------
  function updateCalc() {
    const rc = parseFloat($("#calc-rc").value), dk = parseFloat($("#calc-decks").value);
    if (!isFinite(rc) || !isFinite(dk) || dk <= 0) { $("#calc-out").textContent = "Introduce números válidos."; return; }
    const tc = rc / dk, edge = -0.5 + 0.5 * tc;
    $("#calc-out").innerHTML = `Cuenta real <strong>${fmtV(Math.round(tc * 10) / 10).replace(".", ",")}</strong><br><span class="muted">Ventaja ≈ ${edge >= 0 ? "+" : "−"}${Math.abs(edge).toFixed(1).replace(".", ",")} %</span>`;
  }
  $("#calc-rc").addEventListener("input", updateCalc);
  $("#calc-decks").addEventListener("input", updateCalc);
  updateCalc();

  (function drawChart() {
    const tcs = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
    const W = 600, H = 250, L = 46, R = 12, T = 16, B = 40;
    const min = -2.5, max = 3, y = v => T + (max - v) / (max - min) * (H - T - B);
    const bw = (W - L - R) / tcs.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:var(--mono);font-size:12px">`;
    for (let g = -2; g <= 3; g++) {
      s += `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)" stroke-width="${g === 0 ? 1.5 : 1}"/>`;
      s += `<text x="${L - 8}" y="${y(g) + 4}" text-anchor="end" fill="var(--muted)">${g > 0 ? "+" : g < 0 ? "−" : ""}${Math.abs(g)}%</text>`;
    }
    tcs.forEach((tc, i) => {
      const e = -0.5 + 0.5 * tc, x = L + i * bw + bw * 0.18, w = bw * 0.64;
      const top = Math.min(y(e), y(0)), h = Math.abs(y(e) - y(0));
      s += `<rect x="${x}" y="${top}" width="${w}" height="${Math.max(h, 1)}" rx="3" fill="${e > 0 ? "var(--good)" : e < 0 ? "var(--bad)" : "var(--muted)"}"/>`;
      s += `<text x="${x + w / 2}" y="${H - B + 18}" text-anchor="middle" fill="var(--ink)">${tc > 0 ? "+" : tc < 0 ? "−" : ""}${Math.abs(tc)}</text>`;
    });
    s += `<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle" fill="var(--muted)">cuenta real</text></svg>`;
    $("#edge-chart").innerHTML = s;
  })();

  // ---------- Progreso y fases ----------
  function valoresPassed() { const b = store.get("valBest", null); return !!(b && b.acc === 100 && b.avg < 800); }
  function barajaPassed() { return store.get("deckHist", []).some(h => h.n === 51 && h.ok && h.manual && h.ms < 25000); }
  function gruposPassed() { return store.get("deckHist", []).some(h => h.n === 51 && h.ok && h.g >= 2 && !h.manual && h.speed <= 800); }
  function estrategiaPassed() { return store.get("stratBest", 0) >= 40; }
  function mesaPassed() { return store.get("mesaBest", 0) >= 10; }
  function realPassed() { return store.get("tcBest", 0) >= 15; }
  function desvPassed() { return store.get("devBest", 0) >= 30; }
  function renderPhases() {
    const P = [
      ["Reglas y estrategia básica", "40 manos seguidas sin fallo en Estrategia.", estrategiaPassed()],
      ["Valores Hi‑Lo", "30 cartas, 100 % de aciertos, media por debajo de 0,8 s.", valoresPassed()],
      ["Cuenta corriente", "Baraja menos una, acertando, en menos de 25 s a tu ritmo.", barajaPassed()],
      ["Contar por grupos", "Baraja menos una con 2 o 3 cartas a la vez, a 0,8 s o más rápido.", gruposPassed()],
      ["Cuenta real", "Racha de 15 en el modo combinado: bandeja y división.", realPassed()],
      ["Desviaciones y apuestas", "Racha de 30 en las Illustrious 18.", desvPassed()],
      ["Mesa simulada", "10 cuentas seguidas acertadas en la mesa.", mesaPassed()]
    ];
    const avail = [true, true, true, true, true, true, true];
    $("#phases").innerHTML = P.map(([t, g, done], i) => {
      const pill = done ? `<span class="pill good">Superada</span>` : avail[i] ? `<span class="pill wait">En práctica</span>` : `<span class="pill wait">Próximamente</span>`;
      return `<div class="phase"><span class="i">${i + 1}</span><div><strong>${t}</strong><div class="muted">${g}</div></div>${pill}</div>`;
    }).join("");
  }

  // ---------- Módulo Valores ----------
  const V = (() => {
    const N = 30;
    let st = null, timer = null;
    const stage = $("#v-stage"), felt = $("#v-felt");
    function idle() {
      st = null; clearInterval(timer);
      $("#v-pos").textContent = ""; $("#v-time").textContent = ""; $("#v-bar").style.width = "0";
      stage.innerHTML = "";
      const h = document.createElement("div"); h.className = "hand";
      newDeck().slice(0, 3).forEach(c => h.appendChild(cardEl(c)));
      const m = document.createElement("p"); m.className = "msg";
      m.textContent = "Usa los botones o el teclado. Cuando falles verás el valor correcto un momento.";
      const b = document.createElement("button"); b.className = "btn primary"; b.innerHTML = "Empezar tanda <kbd>Espacio</kbd>";
      b.addEventListener("click", start);
      stage.append(h, m, b);
    }
    function start() {
      $("#v-result").hidden = true;
      const cards = [];
      while (cards.length < N) cards.push(...newDeck());
      st = { cards: cards.slice(0, N), i: 0, res: [], t0: 0, lock: false, startAll: performance.now() };
      timer = setInterval(() => { if (st) $("#v-time").textContent = fmtS(performance.now() - st.startAll); }, 100);
      next();
    }
    function next() {
      if (st.i >= N) return finish();
      const c = st.cards[st.i];
      stage.innerHTML = ""; stage.appendChild(cardEl(c));
      $("#v-pos").textContent = `${st.i + 1} / ${N}`;
      $("#v-bar").style.width = (st.i / N * 100) + "%";
      felt.classList.remove("flash-good", "flash-bad");
      st.t0 = performance.now(); st.lock = false;
    }
    function answer(v) {
      if (!st || st.lock) return;
      st.lock = true;
      const c = st.cards[st.i], ms = performance.now() - st.t0, ok = v === c.v;
      st.res.push({ c, ms, ok });
      felt.classList.add(ok ? "flash-good" : "flash-bad");
      if (!ok) {
        const m = document.createElement("p"); m.className = "msg";
        m.innerHTML = `Era <strong class="mono">${fmtV(c.v)}</strong>`;
        stage.appendChild(m);
      }
      st.i++;
      setTimeout(() => st && next(), ok ? 140 : 900);
    }
    function finish() {
      clearInterval(timer);
      const r = st.res, hits = r.filter(x => x.ok).length, acc = Math.round(hits / N * 100);
      const avg = r.reduce((a, x) => a + x.ms, 0) / N;
      const byRank = {};
      r.forEach(x => { (byRank[x.c.r] ||= []).push(x.ms); });
      const slow = Object.entries(byRank).map(([k, a]) => [k, a.reduce((p, q) => p + q, 0) / a.length]).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const errs = r.filter(x => !x.ok);
      const best = store.get("valBest", null);
      const better = !best || acc > best.acc || (acc === best.acc && avg < best.avg);
      if (better) store.set("valBest", { acc, avg, date: Date.now() });
      const passed = acc === 100 && avg < 800;
      $("#v-bar").style.width = "100%";
      $("#v-result").hidden = false;
      $("#v-result").innerHTML = `
        <div class="row" style="justify-content:space-between;"><h3>Resultado de la tanda</h3>${passed ? '<span class="pill good">Objetivo cumplido</span>' : '<span class="pill wait">Sigue practicando</span>'}</div>
        <div class="stats">
          <div class="stat"><div class="label">Aciertos</div><div class="n ${acc === 100 ? "good" : "bad"}">${acc} %</div></div>
          <div class="stat"><div class="label">Media por carta</div><div class="n ${avg < 800 ? "good" : ""}">${fmtS(avg)}</div></div>
          <div class="stat"><div class="label">Cartas más lentas</div><div class="n" style="font-size:1.1rem">${slow.map(s => s[0]).join(" · ")}</div></div>
        </div>
        ${errs.length ? `<div><div class="label" style="margin-bottom:8px">Fallos</div><div class="review">${errs.map(x => `<div class="it">${cardEl(x.c, true).outerHTML}<span class="v">${fmtV(x.c.v)}</span></div>`).join("")}</div></div>` : ""}
        <p class="muted">${passed ? "Ya reconoces los valores al instante. Pasa a la cuenta de baraja." : acc < 100 ? "Primero la precisión: repite hasta que no falles ninguna." : "Precisión perfecta. Ahora intenta bajar de 0,8 s de media."}</p>`;
      if (better) renderBest();
      idle();
      $("#v-stage .msg").textContent = "Tanda terminada. ¿Otra?";
    }
    function renderBest() {
      const b = store.get("valBest", null);
      $("#v-best").innerHTML = b
        ? `<div class="stat"><div class="label">Mejor precisión</div><div class="n">${b.acc} %</div></div><div class="stat"><div class="label">Media en esa tanda</div><div class="n">${fmtS(b.avg)}</div></div>`
        : `<p class="muted">Aún no has completado ninguna tanda. Cuando lo hagas, tu mejor marca aparecerá aquí.</p>`;
      $("#v-badge").innerHTML = valoresPassed() ? '<span class="pill good">Fase 2 superada</span>' : "";
    }
    $("#v-answer").addEventListener("click", e => { const b = e.target.closest("[data-val]"); if (b) answer(parseInt(b.dataset.val, 10)); });
    document.addEventListener("keydown", e => {
      if (current !== "valores" || e.target.matches("input, select")) return;
      const k = e.key.toLowerCase();
      if (!st && (k === " " || k === "enter")) { e.preventDefault(); start(); return; }
      const map = { a: 1, arrowleft: 1, s: 0, arrowdown: 0, d: -1, arrowright: -1 };
      if (k in map) { e.preventDefault(); answer(map[k]); }
    });
    renderBest(); idle();
    return { abort() { if (st) idle(); } };
  })();

  // ---------- Módulo Cuenta de baraja ----------
  const D = (() => {
    let st = null, auto = null, clock = null;
    const stage = $("#d-stage");
    function idle(msg) {
      st = null; clearTimeout(auto); clearInterval(clock);
      $("#d-pos").textContent = ""; $("#d-time").textContent = ""; $("#d-bar").style.width = "0";
      $("#d-settings").hidden = false; $("#d-answer").hidden = true;
      stage.innerHTML = "";
      const m = document.createElement("p"); m.className = "msg";
      m.textContent = msg || "Elige cuántas cartas y a qué ritmo. A tu ritmo, pasas de carta con Espacio o tocando el tapete.";
      const b = document.createElement("button"); b.className = "btn primary"; b.innerHTML = "Repartir <kbd>Espacio</kbd>";
      b.addEventListener("click", e => { e.stopPropagation(); start(); });
      stage.append(m, b);
    }
    function start() {
      const n = parseInt($("#d-n").value, 10), speed = parseInt($("#d-speed").value, 10), g = parseInt($("#d-group").value, 10);
      const deck = newDeck();
      st = { n, speed, g, cards: deck.slice(0, n), missing: n === 51 ? deck[51] : null, i: 0, t0: performance.now(), phase: "deal" };
      $("#d-settings").hidden = true; $("#d-result").hidden = true;
      clock = setInterval(() => { if (st && st.phase === "deal") $("#d-time").textContent = fmtS(performance.now() - st.t0); }, 100);
      step();
    }
    function step() {
      if (!st || st.phase !== "deal") return;
      if (st.i >= st.n) return ask();
      const grp = st.cards.slice(st.i, st.i + st.g);
      st.i += grp.length;
      const h = document.createElement("div"); h.className = "hand";
      grp.forEach(c => h.appendChild(cardEl(c)));
      stage.innerHTML = ""; stage.appendChild(h);
      $("#d-pos").textContent = `${st.i} / ${st.n}`;
      $("#d-bar").style.width = (st.i / st.n * 100) + "%";
      if (st.speed > 0) auto = setTimeout(step, st.speed * grp.length);
    }
    function ask() {
      st.phase = "ask"; st.ms = performance.now() - st.t0;
      clearInterval(clock); clearTimeout(auto);
      $("#d-time").textContent = fmtS(st.ms);
      stage.innerHTML = `<p class="msg">Fin del reparto. Escribe tu cuenta abajo.</p>`;
      $("#d-answer").hidden = false;
      const inp = $("#d-input"); inp.value = "0"; inp.focus(); inp.select();
    }
    function parseAns() {
      const v = parseInt($("#d-input").value.replace("−", "-").replace(/\s/g, ""), 10);
      return isFinite(v) ? v : null;
    }
    function check() {
      if (!st || st.phase !== "ask") return;
      const a = parseAns();
      if (a === null) { $("#d-input").focus(); return; }
      const truth = st.cards.reduce((s, c) => s + c.v, 0), ok = a === truth;
      const manual = st.speed === 0;
      const hist = store.get("deckHist", []);
      hist.unshift({ n: st.n, g: st.g, manual, speed: st.speed, ms: Math.round(st.ms), ok, date: Date.now() });
      store.set("deckHist", hist.slice(0, 12));
      let run = 0;
      const rev = st.cards.map(c => { run += c.v; return `<div class="it">${cardEl(c, true).outerHTML}<span class="v">${fmtV(c.v)}</span><strong>${fmtV(run)}</strong></div>`; }).join("");
      let extra = "";
      if (st.missing) {
        const mv = st.missing.v;
        extra = `<p>La carta que faltaba era <strong>${st.missing.r}${st.missing.s}</strong>, de valor <span class="mono">${fmtV(mv)}</span>. Fíjate: cuenta ${fmtV(truth)} ${mv >= 0 ? "+" : "−"} ${Math.abs(mv)} = 0, porque la baraja completa siempre suma 0. ${ok ? "Con tu cuenta podías deducir su tipo." : ""}</p>`;
      }
      const perCard = st.ms / st.n;
      const goal = st.n === 51 && manual && ok && st.ms < 25000;
      $("#d-answer").hidden = true;
      $("#d-result").hidden = false;
      $("#d-result").innerHTML = `
        <div class="row" style="justify-content:space-between;"><h3>${ok ? "Cuenta correcta" : "Cuenta incorrecta"}</h3>${goal ? '<span class="pill good">Objetivo de la fase 3</span>' : ok ? '<span class="pill good">Acierto</span>' : '<span class="pill bad">Fallo</span>'}</div>
        <div class="stats">
          <div class="stat"><div class="label">Tu respuesta</div><div class="n ${ok ? "good" : "bad"}">${fmtV(a)}</div></div>
          <div class="stat"><div class="label">Cuenta correcta</div><div class="n">${fmtV(truth)}</div></div>
          <div class="stat"><div class="label">Tiempo</div><div class="n">${fmtS(st.ms)}</div></div>
          <div class="stat"><div class="label">Por carta</div><div class="n">${fmtS(perCard)}</div></div>
        </div>
        ${extra}
        <div><div class="label" style="margin-bottom:8px">Repaso carta a carta: valor y cuenta acumulada</div><div class="review">${rev}</div></div>
        <div class="row"><button class="btn primary" id="d-again">Repetir con los mismos ajustes</button><button class="btn ghost" id="d-change">Cambiar ajustes</button></div>`;
      $("#d-again").addEventListener("click", start);
      $("#d-change").addEventListener("click", () => { $("#d-result").hidden = true; idle(); });
      renderHist();
      st.phase = "done";
      stage.innerHTML = `<p class="msg">${ok ? "Bien contado." : "Revisa abajo en qué carta se torció la cuenta."}</p>`;
    }
    function renderHist() {
      const h = store.get("deckHist", []);
      const spd = x => x.manual ? "A tu ritmo" : (x.speed / 1000).toString().replace(".", ",") + " s/carta";
      $("#d-history").innerHTML = h.length
        ? `<table class="history"><thead><tr><th>Cartas</th><th>Ritmo</th><th>A la vez</th><th class="num">Tiempo</th><th>Resultado</th></tr></thead><tbody>${h.map(x => `<tr><td class="mono">${x.n}</td><td>${spd(x)}</td><td class="mono">${x.g}</td><td class="num mono">${fmtS(x.ms)}</td><td>${x.ok ? '<span class="pill good">Acierto</span>' : '<span class="pill bad">Fallo</span>'}</td></tr>`).join("")}</tbody></table>`
        : `<p class="muted">Aquí verás tus últimos 12 intentos. Empieza con 20 cartas a ritmo medio.</p>`;
      $("#d-badge").innerHTML = barajaPassed() ? '<span class="pill good">Fase 3 superada</span>' : "";
    }
    $("#d-felt").addEventListener("click", () => { if (st && st.phase === "deal" && st.speed === 0) step(); });
    $("#d-minus").addEventListener("click", () => { $("#d-input").value = String((parseAns() ?? 0) - 1); });
    $("#d-plus").addEventListener("click", () => { $("#d-input").value = String((parseAns() ?? 0) + 1); });
    $("#d-check").addEventListener("click", check);
    $("#d-input").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); check(); } });
    document.addEventListener("keydown", e => {
      if (current !== "baraja" || e.target.matches("input, select")) return;
      if (e.key === " " || e.key === "Enter") {
        if (!st || st.phase === "done") { e.preventDefault(); start(); }
        else if (st.phase === "deal" && st.speed === 0) { e.preventDefault(); step(); }
      }
      if (e.key === "Escape" && st && st.phase === "deal") idle("Reparto detenido.");
    });
    renderHist(); idle();
    return { abort() { if (st && st.phase !== "done") idle(); } };
  })();

  // ---------- Estrategia básica: 6 barajas, el crupier se planta con 17 blando, doblar tras separar ----------
  const BUST = { 2: 35, 3: 37, 4: 40, 5: 42, 6: 42, 7: 26, 8: 24, 9: 23, 10: 21, 11: 17 };
  const ACT = { H: "Pedir", S: "Plantarse", D: "Doblar", P: "Separar" };
  const upName = u => u === 11 ? "A" : String(u);
  const betUnits = tc => tc <= 1 ? 1 : tc === 2 ? 2 : tc === 3 ? 4 : tc === 4 ? 6 : 8;
  const edgeText = tc => { const e = -0.5 + 0.5 * tc; return (e > 0 ? "+" : e < 0 ? "−" : "") + Math.abs(e).toFixed(1).replace(".", ",") + " %"; };
  const dec = x => String(x).replace(".", ",");
  function handValue(cards) {
    let t = 0, a = 0;
    for (const c of cards) { t += c.n; if (c.n === 11) a++; }
    while (t > 21 && a) { t -= 10; a--; }
    return { t, soft: a > 0 };
  }
  // Códigos de la tabla: H pedir, S plantarse, D doblar o pedir, Ds doblar o plantarse
  function totalCode(t, soft, up) {
    if (soft) {
      if (t >= 19) return "S";
      if (t === 18) return up >= 3 && up <= 6 ? "Ds" : up <= 8 ? "S" : "H";
      if (t === 17) return up >= 3 && up <= 6 ? "D" : "H";
      if (t >= 15) return up >= 4 && up <= 6 ? "D" : "H";
      if (t >= 13) return up >= 5 && up <= 6 ? "D" : "H";
      return "H";
    }
    if (t >= 17) return "S";
    if (t >= 13) return up <= 6 ? "S" : "H";
    if (t === 12) return up >= 4 && up <= 6 ? "S" : "H";
    if (t === 11) return up <= 10 ? "D" : "H";
    if (t === 10) return up <= 9 ? "D" : "H";
    if (t === 9) return up >= 3 && up <= 6 ? "D" : "H";
    return "H";
  }
  function splitsPair(n, up) {
    switch (n) {
      case 11: case 8: return true;
      case 2: case 3: case 7: return up <= 7;
      case 4: return up === 5 || up === 6;
      case 6: return up <= 6;
      case 9: return up <= 9 && up !== 7;
      default: return false; // 5,5 se juega como 10 y 10,10 como 20
    }
  }
  function basicAction(cards, up, canDouble, canSplit) {
    if (canSplit && cards.length === 2 && cards[0].n === cards[1].n && splitsPair(cards[0].n, up)) return "P";
    const { t, soft } = handValue(cards), c = totalCode(t, soft, up);
    if (c === "D") return canDouble ? "D" : "H";
    if (c === "Ds") return canDouble ? "D" : "S";
    return c;
  }
  function explain(cards, up, a) {
    const { t, soft } = handValue(cards), u = upName(up), pair = cards.length === 2 && cards[0].n === cards[1].n;
    if (a === "P") {
      if (cards[0].n === 11) return "Separa siempre los ases: cada uno es un buen comienzo para llegar a 21.";
      if (cards[0].n === 8) return "16 es la peor mano posible. Separando empiezas dos manos desde 8.";
      return `Contra un ${u}, dos manos que empiezan en ${cards[0].n} ganan más que un ${t} jugado entero.`;
    }
    if (pair && cards[0].n === 10) return "20 ya es una mano excelente. No la rompas.";
    if (pair && cards[0].n === 5) return "Dos cincos son un 10: se dobla, no se separa.";
    if (a === "D") return soft
      ? `Con una mano blanda no te pasas con una carta, y el ${u} del crupier es débil: se pasa un ${BUST[up]} % de las veces. Es el momento de apostar más.`
      : `Con ${t} es fácil terminar en una mano alta con una sola carta. Doblas porque aquí la ventaja es tuya.`;
    if (!soft && t >= 12 && t <= 16) return a === "S"
      ? `El crupier enseña un ${u} y se pasa alrededor del ${BUST[up]} % de las veces. Deja que se arriesgue él.`
      : `Contra un ${u} el crupier solo se pasa un ${BUST[up]} % de las veces. Plantado con ${t} pierdes demasiado.`;
    if (soft && t === 18 && a === "H") return `18 blando parece bueno, pero contra un ${u} pierde a la larga. Como es blando, pedir no te puede pasar.`;
    if (a === "S") return `Con ${t} te plantas.`;
    return soft ? `Con ${t} blando no te puedes pasar pidiendo una carta.` : `Con ${t} no te puedes pasar, así que pides.`;
  }
  function handLabel(cards) {
    const { t, soft } = handValue(cards);
    if (cards.length === 2 && cards[0].n === cards[1].n) return cards[0].n === 11 ? "Pareja de ases" : cards[0].n === 10 ? "Pareja de dieces (20)" : `Pareja de ${cards[0].n}`;
    return `${t} ${soft ? "blando" : "duro"}`;
  }

  const E = (() => {
    let cur = null, waiting = false, streak = 0, tot = 0, hits = 0;
    const cat = { hard: [0, 0], soft: [0, 0], pair: [0, 0] };
    const kindOf = cards => cards[0].n === cards[1].n ? "pair" : handValue(cards).soft ? "soft" : "hard";
    function drillHand() {
      const r = Math.random(), want = r < 0.5 ? "hard" : r < 0.75 ? "soft" : "pair";
      for (;;) {
        const d = newDeck(), cards = [d[0], d[1]], up = d[2], { t } = handValue(cards), k = kindOf(cards);
        if (k !== want || t === 21) continue;
        if (k === "hard" && (t >= 18 || t <= 7) && Math.random() < 0.85) continue;
        return { cards, up };
      }
    }
    function deal() {
      cur = drillHand(); waiting = false;
      $("#e-up").innerHTML = ""; $("#e-up").appendChild(cardEl(cur.up));
      $("#e-hand").innerHTML = ""; cur.cards.forEach(c => $("#e-hand").appendChild(cardEl(c)));
      $("#e-label").textContent = handLabel(cur.cards);
      $("#e-feedback").hidden = true;
      $("#e-felt").classList.remove("flash-good", "flash-bad");
    }
    function answer(a) {
      if (!cur || waiting) return;
      waiting = true;
      const right = basicAction(cur.cards, cur.up.n, true, true), ok = a === right, k = kindOf(cur.cards);
      tot++; cat[k][1]++;
      if (ok) { hits++; cat[k][0]++; streak++; } else streak = 0;
      if (streak > store.get("stratBest", 0)) store.set("stratBest", streak);
      $("#e-felt").classList.add(ok ? "flash-good" : "flash-bad");
      const fb = $("#e-feedback");
      fb.hidden = false;
      fb.innerHTML = `<div class="row" style="justify-content:space-between;"><h3>${ok ? "Correcto: " + ACT[right] : "Lo correcto es " + ACT[right]}</h3>${ok ? '<span class="pill good">Bien</span>' : `<span class="pill bad">Elegiste ${ACT[a]}</span>`}</div>
        <p>${explain(cur.cards, cur.up.n, right)}</p>
        ${ok ? "" : '<div class="row"><button class="btn primary" id="e-next">Siguiente mano <kbd>Enter</kbd></button></div>'}`;
      renderStats();
      if (ok) setTimeout(deal, 1100);
      else $("#e-next").addEventListener("click", deal);
    }
    function renderStats() {
      const pct = ([h, n]) => n ? Math.round(h / n * 100) + " %" : "–";
      $("#e-streak").textContent = `Racha ${streak}`;
      $("#e-stats").innerHTML = `
        <div class="stat"><div class="label">Aciertos</div><div class="n">${tot ? Math.round(hits / tot * 100) + " %" : "–"}</div></div>
        <div class="stat"><div class="label">Racha actual</div><div class="n">${streak}</div></div>
        <div class="stat"><div class="label">Mejor racha</div><div class="n ${estrategiaPassed() ? "good" : ""}">${store.get("stratBest", 0)}</div></div>
        <div class="stat"><div class="label">Duras · blandas · parejas</div><div class="n" style="font-size:1.05rem">${pct(cat.hard)} · ${pct(cat.soft)} · ${pct(cat.pair)}</div></div>`;
      $("#e-badge").innerHTML = estrategiaPassed() ? '<span class="pill good">Fase 1 superada</span>' : "";
    }
    function renderChart() {
      const ups = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const LBL = { H: "Pe", S: "Pl", D: "Do", Ds: "Dp", P: "Se" };
      const row = (name, f) => `<tr><th>${name}</th>${ups.map(u => { const c = f(u); return `<td class="c-${c}">${LBL[c]}</td>`; }).join("")}</tr>`;
      const sec = t => `<tr class="sec"><th colspan="11">${t}</th></tr>`;
      let h = `<table class="chart-t"><thead><tr><th>Tu mano</th>${ups.map(u => `<th>${upName(u)}</th>`).join("")}</tr></thead><tbody>`;
      h += sec("Totales duros") + row("5–8", u => totalCode(8, false, u));
      for (let t = 9; t <= 16; t++) h += row(t, u => totalCode(t, false, u));
      h += row("17+", () => "S");
      h += sec("Totales blandos");
      for (let k = 2; k <= 9; k++) h += row("A," + k, u => totalCode(11 + k, true, u));
      h += sec("Parejas");
      for (let n = 2; n <= 11; n++) h += row(n === 11 ? "A,A" : `${n},${n}`, u => splitsPair(n, u) ? "P" : totalCode(n * 2, false, u));
      $("#e-chart").innerHTML = h + "</tbody></table>";
      $("#e-bust").innerHTML = `<table class="chart-t"><thead><tr><th>Crupier</th>${ups.map(u => `<th>${upName(u)}</th>`).join("")}</tr></thead><tbody><tr><th>Se pasa</th>${ups.map(u => `<td class="${u <= 6 ? "c-D" : ""}">${BUST[u]} %</td>`).join("")}</tr></tbody></table>`;
    }
    $("#e-answer").addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b) answer(b.dataset.act); });
    document.addEventListener("keydown", e => {
      if (current !== "estrategia" || e.target.matches("input, select")) return;
      const map = { "1": "H", "2": "S", "3": "D", "4": "P" };
      if (e.key in map) { e.preventDefault(); answer(map[e.key]); }
      else if (e.key === "Enter" && waiting && $("#e-next")) { e.preventDefault(); deal(); }
    });
    renderChart(); renderStats(); deal();
    return {};
  })();

  // ---------- Mesa simulada ----------
  const M = (() => {
    const DECKS = 6, CUT = Math.round(52 * DECKS * 0.25);
    let shoe = [], rc = 0, busy = false, resolveAct = null, resolveQuiz = null;
    let seats = [], dealer = [], holeHidden = true, activeHand = null;
    const stats = { hands: 0, dec: 0, decOk: 0, q: 0, qOk: 0, units: 0, streak: 0 };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const opt = () => ({ bots: +$("#m-bots").value, speed: +$("#m-speed").value, ask: $("#m-ask").value, hints: $("#m-hints").checked });
    const newHand = () => ({ cards: [], bet: 1, done: false, bust: false, fromSplit: false, splitAces: false, result: null });
    const isBJ = h => h.cards.length === 2 && !h.fromSplit && handValue(h.cards).t === 21;
    function reshuffle() { shoe = []; for (let i = 0; i < DECKS; i++) shoe.push(...newDeck()); shuffle(shoe); rc = 0; }
    function give(h) { const c = shoe.pop(); rc += c.v; c.fresh = true; h.cards.push(c); }
    function setMsg(t) { $("#m-msg").textContent = t; }
    function tcard(c, hidden) {
      let el;
      if (hidden) { el = document.createElement("div"); el.className = "card back"; el.setAttribute("role", "img"); el.setAttribute("aria-label", "Carta tapada"); }
      else el = cardEl(c);
      el.classList.add("sm");
      if (!c.fresh) el.classList.remove("deal");
      c.fresh = false;
      return el;
    }
    function totText(cards) {
      const { t, soft } = handValue(cards);
      if (t > 21) return `${t} · se pasa`;
      return soft && t < 21 ? `${t - 10} / ${t}` : String(t);
    }
    function render() {
      $("#m-shoe").textContent = `Sabot: ${(shoe.length / 52).toFixed(1).replace(".", ",")} barajas`;
      $("#m-count").textContent = $("#m-show").checked ? `Cuenta ${fmtV(rc)}` : "";
      const d = $("#m-dealer"); d.innerHTML = "";
      dealer.forEach((c, i) => d.appendChild(tcard(c, i === 1 && holeHidden)));
      $("#m-dtot").textContent = !dealer.length ? "" : holeHidden ? `${upName(dealer[0].n)} + ?` : totText(dealer);
      const box = $("#m-seats"); box.innerHTML = "";
      for (const s of seats) {
        const el = document.createElement("div"); el.className = "seat" + (s.bot ? "" : " you");
        el.innerHTML = `<div class="who">${s.name}</div>`;
        for (const h of s.hands) {
          const hb = document.createElement("div"); hb.className = "handbox" + (h === activeHand ? " active" : "");
          const st = document.createElement("div"); st.className = "stack";
          h.cards.forEach(c => st.appendChild(tcard(c, false)));
          const res = h.result === null ? "" : h.result > 0 ? `<span class="pill good">+${String(h.result).replace(".", ",")}</span>` : h.result < 0 ? `<span class="pill bad">${String(h.result).replace("-", "−")}</span>` : `<span class="pill wait">Empate</span>`;
          hb.appendChild(st);
          hb.insertAdjacentHTML("beforeend", `<div class="tot">${h.cards.length ? (isBJ(h) ? "Blackjack" : totText(h.cards)) : ""}${h.bet > 1 ? " · doblada" : ""}</div>${res}`);
          el.appendChild(hb);
        }
        box.appendChild(el);
      }
    }
    function setButtons(f) {
      const on = !!f;
      $("#m-actions").querySelectorAll("[data-act]").forEach(b => {
        const a = b.dataset.act;
        b.disabled = !on || (a === "D" && !f.canD) || (a === "P" && !f.canP);
      });
      $("#m-deal").disabled = busy;
    }
    async function revealHole(pace) {
      holeHidden = false; rc += dealer[1].v; dealer[1].fresh = true; render(); await sleep(pace);
    }
    async function playHand(s, h, up, o) {
      activeHand = h; render();
      if (isBJ(h)) { h.done = true; return; }
      while (!h.done) {
        const v = handValue(h.cards).t;
        if (v > 21) { h.bust = true; h.done = true; break; }
        if (v === 21 || (h.splitAces && h.cards.length >= 2)) { h.done = true; break; }
        const canD = h.cards.length === 2, canP = canD && h.cards[0].n === h.cards[1].n && s.hands.length === 1;
        let a;
        if (s.bot) { await sleep(o.speed); a = basicAction(h.cards, up, canD, canP); }
        else {
          setButtons({ canD, canP });
          a = await new Promise(r => { resolveAct = r; });
          resolveAct = null; setButtons(null);
          const right = basicAction(h.cards, up, canD, canP);
          stats.dec++;
          if (a === right) { stats.decOk++; setMsg(""); }
          else if (o.hints) setMsg(`Estrategia básica: ${ACT[right]}. ${explain(h.cards, up, right)}`);
          renderStats();
        }
        if (a === "S") h.done = true;
        else if (a === "H") give(h);
        else if (a === "D") { h.bet = 2; give(h); h.done = true; if (handValue(h.cards).t > 21) h.bust = true; }
        else if (a === "P") {
          const h2 = newHand(); h2.cards = [h.cards.pop()];
          h.fromSplit = h2.fromSplit = true;
          if (h.cards[0].n === 11) h.splitAces = h2.splitAces = true;
          s.hands.push(h2); render(); await sleep(o.speed);
          give(h); render(); await sleep(o.speed);
          give(h2);
        }
        render();
        if (a !== "S") await sleep(o.speed / 2);
      }
      render();
    }
    function settle(dealerBJ) {
      const d = handValue(dealer).t, dBust = d > 21;
      for (const s of seats) for (const h of s.hands) {
        const p = handValue(h.cards).t, bj = isBJ(h);
        let r;
        if (dealerBJ) r = bj ? 0 : -h.bet;
        else if (bj) r = 1.5;
        else if (p > 21) r = -h.bet;
        else if (dBust || p > d) r = h.bet;
        else if (p < d) r = -h.bet;
        else r = 0;
        h.result = r;
        if (!s.bot) stats.units += r;
      }
    }
    async function round() {
      if (busy) return;
      busy = true; setButtons(null);
      const o = opt(), pace = o.speed;
      $("#m-quiz").hidden = true;
      if (shoe.length < CUT) { reshuffle(); seats = []; dealer = []; setMsg("Sabot nuevo: la cuenta vuelve a 0."); render(); await sleep(1200); }
      const names = o.bots === 0 ? [null] : o.bots === 1 ? ["Jugador 1", null] : ["Jugador 1", null, "Jugador 2"];
      seats = names.map(n => ({ name: n || "Tú", bot: !!n, hands: [newHand()] }));
      dealer = []; holeHidden = true; activeHand = null; setMsg("");
      for (let r = 0; r < 2; r++) {
        for (const s of seats) { give(s.hands[0]); render(); await sleep(pace); }
        const c = shoe.pop(); c.fresh = true; if (r === 0) rc += c.v; dealer.push(c); render(); await sleep(pace);
      }
      const up = dealer[0].n, peek = up >= 10, dealerBJ = peek && handValue(dealer).t === 21;
      if (dealerBJ) {
        setMsg("El crupier mira su carta tapada: tiene blackjack.");
        await revealHole(pace);
      } else {
        if (peek) { setMsg("El crupier mira su carta tapada: no tiene blackjack."); await sleep(pace); }
        for (const s of seats) for (let i = 0; i < s.hands.length; i++) await playHand(s, s.hands[i], up, o);
        activeHand = null;
        await revealHole(pace);
        const live = seats.some(s => s.hands.some(h => !h.bust && !isBJ(h)));
        while (live && handValue(dealer).t < 17) { give({ cards: dealer }); render(); await sleep(pace); }
      }
      settle(dealerBJ); stats.hands++; render(); renderStats();
      if (o.ask === "always" || (o.ask === "some" && Math.random() < 0.35)) await quiz();
      busy = false; setButtons(null);
    }
    async function quiz() {
      $("#m-quiz").hidden = false; $("#m-qres").innerHTML = ""; $("#m-check").disabled = false;
      const inp = $("#m-input"); inp.value = "0"; inp.focus(); inp.select();
      const a = await new Promise(r => { resolveQuiz = r; });
      resolveQuiz = null; $("#m-check").disabled = true;
      const ok = a === rc;
      stats.q++;
      if (ok) { stats.qOk++; stats.streak++; } else stats.streak = 0;
      if (stats.streak > store.get("mesaBest", 0)) store.set("mesaBest", stats.streak);
      const rem = shoe.length / 52, tc = Math.trunc(rc / rem), u = betUnits(tc);
      $("#m-qres").innerHTML = (ok ? `<span class="pill good">Correcto: ${fmtV(rc)}</span>` : `<span class="pill bad">Era ${fmtV(rc)}</span><span class="muted">Dijiste ${fmtV(a)}</span>`)
        + `<span class="muted">Quedan ${rem.toFixed(1).replace(".", ",")} barajas: cuenta real ${fmtV(tc)}, ventaja ≈ ${edgeText(tc)}, apuesta ${u} ${u === 1 ? "unidad" : "unidades"}.</span>`;
      renderStats();
      $("#m-deal").focus();
    }
    function renderStats() {
      const u = stats.units;
      $("#m-stats").innerHTML = `
        <div class="stat"><div class="label">Manos</div><div class="n">${stats.hands}</div></div>
        <div class="stat"><div class="label">Jugadas correctas</div><div class="n">${stats.dec ? Math.round(stats.decOk / stats.dec * 100) + " %" : "–"}</div></div>
        <div class="stat"><div class="label">Cuentas acertadas</div><div class="n">${stats.qOk} / ${stats.q}</div></div>
        <div class="stat"><div class="label">Racha · mejor</div><div class="n">${stats.streak} · ${store.get("mesaBest", 0)}</div></div>
        <div class="stat"><div class="label">Balance (unidades)</div><div class="n ${u > 0 ? "good" : u < 0 ? "bad" : ""}">${u > 0 ? "+" : u < 0 ? "−" : ""}${String(Math.abs(u)).replace(".", ",")}</div></div>`;
      $("#m-badge").innerHTML = mesaPassed() ? '<span class="pill good">Fase 7 superada</span>' : "";
    }
    function act(a) {
      const b = $(`#m-actions [data-act="${a}"]`);
      if (resolveAct && b && !b.disabled) resolveAct(a);
    }
    function checkQuiz() { const v = parseNum($("#m-input").value); if (resolveQuiz && v !== null) resolveQuiz(v); }
    $("#m-actions").addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b) act(b.dataset.act); });
    $("#m-deal").addEventListener("click", round);
    $("#m-check").addEventListener("click", checkQuiz);
    $("#m-input").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); checkQuiz(); } });
    $("#m-minus").addEventListener("click", () => { $("#m-input").value = String((parseNum($("#m-input").value) ?? 0) - 1); });
    $("#m-plus").addEventListener("click", () => { $("#m-input").value = String((parseNum($("#m-input").value) ?? 0) + 1); });
    $("#m-show").addEventListener("change", render);
    document.addEventListener("keydown", e => {
      if (current !== "mesa" || e.target.matches("input, select")) return;
      const map = { "1": "H", "2": "S", "3": "D", "4": "P" };
      if (e.key in map) { e.preventDefault(); act(map[e.key]); }
      else if (e.key === " " && !busy) { e.preventDefault(); round(); }
    });
    reshuffle(); render(); renderStats(); setButtons(null);
    setMsg("Pulsa «Repartir mano» para empezar. Cuenta todas las cartas que veas.");
    return {};
  })();

  // ---------- Cuenta real ----------
  const T = (() => {
    const REMS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5];
    let cur = null, waiting = false, tot = 0, hits = 0, streak = 0;
    function traySVG(disc, marks) {
      const W = 170, x = 40, w = 80, top = 14, per = 40, bottom = top + per * 6, H = bottom + 30, h = disc * per;
      let s = `<svg class="tray" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bandeja de descartes" style="font-family:var(--mono);font-size:12px">`;
      s += `<rect x="${x + 3}" y="${bottom - h}" width="${w - 6}" height="${h}" fill="var(--card)"/>`;
      for (let y = bottom - h + 2; y < bottom; y += 3) s += `<line x1="${x + 3}" x2="${x + w - 3}" y1="${y}" y2="${y}" stroke="var(--card-ink)" stroke-opacity="0.13"/>`;
      s += `<path d="M${x} ${top} V${bottom} H${x + w} V${top}" fill="none" stroke="var(--felt-ink)" stroke-opacity="0.75" stroke-width="3"/>`;
      if (marks) for (let d = 1; d <= 6; d++) {
        const y = bottom - d * per;
        s += `<line x1="${x + w}" x2="${x + w + 9}" y1="${y}" y2="${y}" stroke="var(--felt-ink)" stroke-opacity="0.75"/><text x="${x + w + 13}" y="${y + 4}" fill="var(--felt-ink)">${d}</text>`;
      }
      return s + `<text x="${x + w / 2}" y="${bottom + 20}" text-anchor="middle" fill="var(--felt-ink)">descartes</text></svg>`;
    }
    function newQ(focus) {
      const m = $("#t-mode").value, rem = REMS[Math.floor(Math.random() * REMS.length)];
      const rc = Math.round((Math.random() * 2 - 0.6) * 4 * rem);
      cur = { m, rem, rc, disc: 6 - rem }; waiting = false;
      $("#t-feedback").hidden = true;
      $("#t-felt").classList.remove("flash-good", "flash-bad");
      const marks = $("#t-marks").checked, rcBox = `<div class="center"><div class="label" style="color:inherit">Cuenta corriente</div><div class="bigtc">${fmtV(rc)}</div>`;
      $("#t-stage").innerHTML = m === "estimate"
        ? `<div class="duo">${traySVG(cur.disc, marks)}<p class="msg">La bandeja llena son 6 barajas. ¿Cuántas barajas <strong>quedan por salir</strong>?</p></div>`
        : m === "divide"
        ? `${rcBox}<p class="msg">Quedan <strong>${dec(rem)}</strong> barajas. ¿Cuál es la cuenta real?</p></div>`
        : `<div class="duo">${traySVG(cur.disc, marks)}${rcBox}<p class="msg">Estima las barajas que quedan y divide.</p></div></div>`;
      $("#t-opts").hidden = m !== "estimate"; $("#t-step").hidden = m === "estimate";
      if (m !== "estimate") { const i = $("#t-input"); i.value = "0"; if (focus) { i.focus({ preventScroll: true }); i.select(); } }
    }
    function grade(ans) {
      if (!cur || waiting) return;
      waiting = true;
      const truth = Math.trunc(cur.rc / cur.rem), exact = (cur.rc / cur.rem).toFixed(2).replace(".", ",");
      let ok, msg;
      if (cur.m === "estimate") {
        const err = Math.abs(ans - cur.rem); ok = err <= 0.5;
        msg = `Quedaban <strong>${dec(cur.rem)}</strong> barajas (hay ${dec(cur.disc)} en la bandeja). ${err === 0 ? "Exacto." : ok ? "Te has desviado media baraja, que en una mesa real es suficiente." : `Dijiste ${dec(ans)}.`}`;
      } else if (cur.m === "divide") {
        ok = ans === truth;
        msg = `${fmtV(cur.rc)} ÷ ${dec(cur.rem)} = ${exact}, que redondeado hacia cero da <strong>${fmtV(truth)}</strong>.`;
      } else {
        const valid = [cur.rem - 0.5, cur.rem, cur.rem + 0.5].map(r => Math.trunc(cur.rc / r));
        ok = valid.includes(ans);
        msg = `Quedaban ${dec(cur.rem)} barajas: ${fmtV(cur.rc)} ÷ ${dec(cur.rem)} = ${exact} → <strong>${fmtV(truth)}</strong>.${ok && ans !== truth ? " Se acepta: es lo que sale fallando media baraja al estimar." : ""}`;
      }
      tot++;
      if (ok) { hits++; streak++; } else streak = 0;
      if (cur.m === "combined" && streak > store.get("tcBest", 0)) store.set("tcBest", streak);
      $("#t-felt").classList.add(ok ? "flash-good" : "flash-bad");
      const fb = $("#t-feedback"); fb.hidden = false;
      fb.innerHTML = `<div class="row" style="justify-content:space-between;"><h3>${ok ? "Correcto" : "No exactamente"}</h3>${ok ? '<span class="pill good">Bien</span>' : '<span class="pill bad">Fallo</span>'}</div><p>${msg}</p>${ok ? "" : '<div class="row"><button class="btn primary" id="t-next">Siguiente <kbd>Enter</kbd></button></div>'}`;
      renderStats();
      if (ok) setTimeout(() => newQ(true), 1400);
      else $("#t-next").addEventListener("click", () => newQ(true));
    }
    function renderStats() {
      $("#t-stats").innerHTML = `
        <div class="stat"><div class="label">Aciertos</div><div class="n">${tot ? Math.round(hits / tot * 100) + " %" : "–"}</div></div>
        <div class="stat"><div class="label">Racha actual</div><div class="n">${streak}</div></div>
        <div class="stat"><div class="label">Mejor racha combinada</div><div class="n ${realPassed() ? "good" : ""}">${store.get("tcBest", 0)}</div></div>`;
      $("#t-badge").innerHTML = realPassed() ? '<span class="pill good">Fase 5 superada</span>' : "";
    }
    $("#t-opts").innerHTML = REMS.map(r => `<button class="btn" data-rem="${r}">${dec(r)}</button>`).join("");
    $("#t-opts").addEventListener("click", e => { const b = e.target.closest("[data-rem]"); if (b) grade(parseFloat(b.dataset.rem)); });
    const check = () => { const v = parseNum($("#t-input").value); if (v !== null) grade(v); };
    $("#t-check").addEventListener("click", check);
    $("#t-input").addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (waiting) { if ($("#t-next")) newQ(true); } else check();
    });
    $("#t-minus").addEventListener("click", () => { $("#t-input").value = String((parseNum($("#t-input").value) ?? 0) - 1); });
    $("#t-plus").addEventListener("click", () => { $("#t-input").value = String((parseNum($("#t-input").value) ?? 0) + 1); });
    $("#t-mode").addEventListener("change", () => { streak = 0; renderStats(); newQ(false); });
    $("#t-marks").addEventListener("change", () => newQ(false));
    document.addEventListener("keydown", e => {
      if (current !== "real" || e.target.matches("input, select")) return;
      if (e.key === "Enter" && waiting && $("#t-next")) { e.preventDefault(); newQ(true); }
    });
    renderStats(); newQ(false);
    return {};
  })();

  // ---------- Desviaciones (Illustrious 18, Hi‑Lo, 6 barajas, S17) y apuestas ----------
  const X = (() => {
    const WHY = {
      stand: "Con la cuenta alta quedan muchas cartas de 10: si pides te pasas más, y el crupier también se pasa más.",
      dbl: "Con la cuenta alta es más probable recibir un 10, así que doblar rinde más.",
      split: "Con la cuenta muy alta, cada 10 es un gran comienzo contra un crupier débil. Es una jugada llamativa: en un casino real delata al contador.",
      ins: "El seguro paga 2:1, así que compensa cuando más de un tercio de las cartas que quedan son dieces. Eso pasa a partir de una cuenta real de +3.",
      neg: "Con la cuenta negativa quedan muchas cartas bajas: pedir es menos peligroso y el crupier se pasa menos."
    };
    const I18 = [
      { ins: true, up: 11, lo: "N", hi: "I", idx: 3, why: "ins" },
      { t: 16, up: 10, lo: "H", hi: "S", idx: 0, why: "stand" },
      { t: 15, up: 10, lo: "H", hi: "S", idx: 4, why: "stand" },
      { pair: true, up: 5, lo: "S", hi: "P", idx: 5, why: "split" },
      { pair: true, up: 6, lo: "S", hi: "P", idx: 4, why: "split" },
      { t: 10, up: 10, lo: "H", hi: "D", idx: 4, why: "dbl" },
      { t: 12, up: 3, lo: "H", hi: "S", idx: 2, why: "stand" },
      { t: 12, up: 2, lo: "H", hi: "S", idx: 3, why: "stand" },
      { t: 11, up: 11, lo: "H", hi: "D", idx: 1, why: "dbl" },
      { t: 9, up: 2, lo: "H", hi: "D", idx: 1, why: "dbl" },
      { t: 10, up: 11, lo: "H", hi: "D", idx: 4, why: "dbl" },
      { t: 9, up: 7, lo: "H", hi: "D", idx: 3, why: "dbl" },
      { t: 16, up: 9, lo: "H", hi: "S", idx: 5, why: "stand" },
      { t: 13, up: 2, lo: "H", hi: "S", idx: -1, why: "neg" },
      { t: 12, up: 4, lo: "H", hi: "S", idx: 0, why: "neg" },
      { t: 12, up: 5, lo: "H", hi: "S", idx: -2, why: "neg" },
      { t: 12, up: 6, lo: "H", hi: "S", idx: -1, why: "neg" },
      { t: 13, up: 3, lo: "H", hi: "S", idx: -2, why: "neg" }
    ];
    const ACTX = { ...ACT, I: "Tomar seguro", N: "No tomar seguro" };
    const rnd = a => a[Math.floor(Math.random() * a.length)];
    const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const mk = r => { const su = rnd(SUITS); return { r, s: su.s, red: su.red, v: hilo(r), n: cardNum(r) }; };
    const rankOf = n => n === 11 ? "A" : n === 10 ? rnd(["10", "J", "Q", "K"]) : String(n);
    const caseName = c => c.ins ? "Seguro contra A" : `${c.pair ? "10,10" : c.t} contra ${upName(c.up)}`;
    function twoCards(t) {
      const opts = [];
      for (let a = 2; a <= 10; a++) { const b = t - a; if (b > a && b <= 10) opts.push([a, b]); }
      const [a, b] = rnd(opts);
      return shuffle([mk(rankOf(a)), mk(rankOf(b))]);
    }
    let cur = null, waiting = false, tot = 0, hits = 0, streak = 0;
    const mode = () => $("#x-mode").value;
    function newQ() {
      waiting = false;
      $("#x-feedback").hidden = true;
      $("#x-felt").classList.remove("flash-good", "flash-bad");
      if (mode() === "bet") {
        const tc = ri(-2, 7);
        cur = { bet: true, tc };
        $("#x-hud-l").textContent = "Antes de repartir"; $("#x-hud-r").textContent = "";
        $("#x-stage").innerHTML = `<div class="center"><div class="label" style="color:inherit">Cuenta real</div><div class="bigtc">${fmtV(tc)}</div><p class="msg">¿Cuántas unidades apuestas en la próxima mano?</p></div>`;
        $("#x-opts").innerHTML = [1, 2, 4, 6, 8].map(u => `<button class="btn" data-a="${u}">${u} ${u === 1 ? "unidad" : "unidades"}</button>`).join("");
        return;
      }
      const c = rnd(I18), tc = c.idx + ri(-3, 3);
      const cards = c.pair ? [mk(rankOf(10)), mk(rankOf(10))] : twoCards(c.ins ? ri(12, 19) : c.t);
      cur = { c, tc, cards };
      $("#x-hud-l").textContent = "El crupier enseña";
      $("#x-hud-r").textContent = `Cuenta real ${fmtV(tc)}`;
      $("#x-stage").innerHTML = `<div class="zone"><div class="hand" id="x-up"></div></div><div class="zone"><div class="hand" id="x-hand"></div><div class="who">${c.ins ? "El crupier ofrece seguro" : handLabel(cards)}</div></div>`;
      $("#x-up").appendChild(cardEl(mk(rankOf(c.up))));
      cards.forEach(k => $("#x-hand").appendChild(cardEl(k)));
      $("#x-opts").innerHTML = [c.lo, c.hi].sort().map(a => `<button class="btn" data-a="${a}">${ACTX[a]}</button>`).join("");
    }
    function grade(a) {
      if (!cur || waiting) return;
      waiting = true;
      let ok, title, msg;
      if (cur.bet) {
        const right = betUnits(cur.tc); ok = +a === right;
        title = ok ? "Correcto" : `Lo correcto son ${right} ${right === 1 ? "unidad" : "unidades"}`;
        msg = `Con cuenta real ${fmtV(cur.tc)} la ventaja es de un ${edgeText(cur.tc)} aproximadamente. ${right === 1 ? "Mientras el casino tenga ventaja, apuestas el mínimo." : "La ventaja es tuya, así que subes la apuesta."}`;
      } else {
        const { c, tc } = cur, right = tc >= c.idx ? c.hi : c.lo; ok = a === right;
        title = ok ? "Correcto: " + ACTX[right] : "Lo correcto es " + ACTX[right];
        msg = `<strong>${caseName(c)}</strong>, índice ${fmtV(c.idx)}: con cuenta real ${fmtV(c.idx)} o más, ${ACTX[c.hi].toLowerCase()}; por debajo, ${ACTX[c.lo].toLowerCase()}. Ahora la cuenta es ${fmtV(tc)}. ${WHY[c.why]}`;
      }
      tot++;
      if (ok) { hits++; streak++; } else streak = 0;
      if (!cur.bet && streak > store.get("devBest", 0)) store.set("devBest", streak);
      $("#x-felt").classList.add(ok ? "flash-good" : "flash-bad");
      const fb = $("#x-feedback"); fb.hidden = false;
      fb.innerHTML = `<div class="row" style="justify-content:space-between;"><h3>${title}</h3>${ok ? '<span class="pill good">Bien</span>' : '<span class="pill bad">Fallo</span>'}</div><p>${msg}</p>${ok ? "" : '<div class="row"><button class="btn primary" id="x-next">Siguiente <kbd>Enter</kbd></button></div>'}`;
      renderStats();
      if (ok) setTimeout(newQ, 1600);
      else $("#x-next").addEventListener("click", newQ);
    }
    function renderStats() {
      $("#x-stats").innerHTML = `
        <div class="stat"><div class="label">Aciertos</div><div class="n">${tot ? Math.round(hits / tot * 100) + " %" : "–"}</div></div>
        <div class="stat"><div class="label">Racha actual</div><div class="n">${streak}</div></div>
        <div class="stat"><div class="label">Mejor racha en desviaciones</div><div class="n ${desvPassed() ? "good" : ""}">${store.get("devBest", 0)}</div></div>`;
      $("#x-badge").innerHTML = desvPassed() ? '<span class="pill good">Fase 6 superada</span>' : "";
    }
    $("#x-table").innerHTML = `<table class="history"><thead><tr><th>#</th><th>Situación</th><th class="num">Índice</th><th>Con cuenta ≥ índice</th><th>Por debajo</th></tr></thead><tbody>${I18.map((c, i) => `<tr><td class="mono">${i + 1}</td><td>${caseName(c)}</td><td class="num mono">${fmtV(c.idx)}</td><td>${ACTX[c.hi]}</td><td class="muted">${ACTX[c.lo]}</td></tr>`).join("")}</tbody></table>`;
    $("#x-ramp").innerHTML = `<table class="history"><thead><tr><th>Cuenta real</th><th>Ventaja aprox.</th><th class="num">Apuesta</th></tr></thead><tbody>${[["≤ +1", 1], ["+2", 2], ["+3", 3], ["+4", 4], ["≥ +5", 5]].map(([l, tc]) => `<tr><td class="mono">${l}</td><td class="mono">${tc === 1 ? "≤ 0 %" : edgeText(tc)}</td><td class="num mono">${betUnits(tc)}</td></tr>`).join("")}</tbody></table>`;
    $("#x-opts").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b) grade(b.dataset.a); });
    $("#x-mode").addEventListener("change", () => { streak = 0; renderStats(); newQ(); });
    document.addEventListener("keydown", e => {
      if (current !== "desv" || e.target.matches("input, select")) return;
      if (e.key === "Enter" && waiting && $("#x-next")) { e.preventDefault(); newQ(); }
      const btns = $("#x-opts").querySelectorAll("[data-a]"), n = parseInt(e.key, 10);
      if (n >= 1 && n <= btns.length) { e.preventDefault(); grade(btns[n - 1].dataset.a); }
    });
    renderStats(); newQ();
    return {};
  })();

  show((location.hash || "").slice(1) || "teoria");
})();
