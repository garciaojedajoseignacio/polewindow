/* PoleWindow static front end. Plain JS, no dependencies. */
(() => {
  "use strict";
  const R_KM = 1737.4;
  const SITE_COLORS = ["#ffd166", "#ff8fab", "#7cc4ff", "#5ad1a8", "#c792ea"];
  const VIRIDIS = [[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];
  const NS = "http://www.w3.org/2000/svg";
  const BAND = { sun: [255, 209, 102], earth: [90, 209, 168], both: [199, 146, 234], bg: [26, 33, 48] };
  const LABEL_POS = { connecting_ridge: [-4, -3, "end"], shackleton_center: [3, -4.5, "start"], peak_near_shackleton: [4, 6.5, "start"] };
  const state = { lang: "en", zoom: "full", method: "t", metric: "both", sortKey: "both_pct", sortAsc: false,
                  site: null, pick: null, target: null, a: 0, b: 8760 };
  let S, G, X, K = 1, VMAX = 100, ORDER = [];
  const filt = { sun: 0, slope: 99, psr: 999 };
  const MEAN_PERIGEE = 363300, MEAN_APOGEE = 405500;
  let BIN = null, OFF = null, NH = 8760, YEAR = 2027;
  const gridCache = new Map();

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ------------------------------------------------------------ i18n */
  const I = window.POLEWINDOW_I18N;
  const EN_STATIC = {};
  function t(key, vars) {
    let s = (I.dyn[state.lang] && I.dyn[state.lang][key]) || I.dyn.en[key] || key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  const locale = () => (state.lang === "es" ? "es-CL" : "en-US");
  const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }));
  const rangeLen = () => state.b - state.a;
  function days(h) {
    if (h >= rangeLen() && h > 0) return t("wholeRange");
    return h >= 48 ? fmt(h / 24, 1) + " d" : h + " h";
  }
  function siteName(s, short) {
    const n = (state.lang === "es" && I.siteNames[s.id]) || s.name;
    return short ? n.replace(/\s*\(.*\)\s*/, "") : n;
  }
  const lonLabel = (lon) => {
    lon = ((lon % 360) + 360) % 360;
    if (lon === 0) return "0°";
    if (lon === 180) return "180°";
    return lon < 180 ? lon + "°E" : (360 - lon) + (state.lang === "es" ? "°O" : "°W");
  };
  const latlonText = (lat, lon) => `${fmt(Math.abs(lat), 3)}°S, ${fmt(((lon % 360) + 360) % 360, 2)}°E`;
  const methodName = () => t(state.method === "t" ? "methT" : "methS");
  const otherMethodName = () => t(state.method === "t" ? "methS" : "methT");
  const hourDate = (h) => new Date(Date.UTC(YEAR, 0, 1) + h * 3600e3);
  const dShort = (d) => d.toLocaleDateString(locale(), { day: "numeric", month: "short", timeZone: "UTC" });
  const dTime = (d) => d.toLocaleString(locale(), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC";
  function rangeLabel() {
    if (state.a === 0 && state.b === NH) return t("rangeFull", { y: YEAR });
    return `${dShort(hourDate(state.a))} – ${dShort(hourDate(state.b - 1))} ${YEAR}`;
  }

  function applyLang(lang) {
    state.lang = lang;
    document.documentElement.lang = lang === "es" ? "es-CL" : "en";
    $$("[data-i18n]").forEach((e) => {
      const k = e.dataset.i18n;
      e.textContent = lang === "en" ? EN_STATIC[k] : (I.es[k] != null ? I.es[k] : EN_STATIC[k]);
    });
    $$("[data-i18n-html]").forEach((e) => {
      const k = e.dataset.i18nHtml;
      e.innerHTML = lang === "en" ? EN_STATIC[k] : (I.es[k] != null ? I.es[k] : EN_STATIC[k]);
    });
    document.title = lang === "es" ? I.es.title : EN_STATIC.title;
    $$("[data-lang]").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
    try { localStorage.setItem("pw-lang", lang); } catch (e) { /* ignore */ }
    if (S) { fillMeta(); fillPresets(); renderAll(); }
  }
  function captureEnglish() {
    $$("[data-i18n]").forEach((e) => (EN_STATIC[e.dataset.i18n] = e.textContent));
    $$("[data-i18n-html]").forEach((e) => (EN_STATIC[e.dataset.i18nHtml] = e.innerHTML));
    EN_STATIC.title = document.title;
  }

  /* ------------------------------------------------------------ hourly data */
  function parseBin(buf) {
    BIN = new Uint16Array(buf);
    const nEntries = BIN[0], nSeries = BIN[1];
    NH = BIN[2];
    OFF = new Uint32Array(nEntries * nSeries);
    let p = 3;
    for (let i = 0; i < nEntries * nSeries; i++) { OFF[i] = p; p += 2 + BIN[p]; }
  }
  function series(entry, s) {
    const p = OFF[entry * 4 + s], n = BIN[p];
    return { init: BIN[p + 1], flips: BIN.subarray(p + 2, p + 2 + n) };
  }
  function runStats(sr, a, b) {
    let st = sr.init, start = 0, on = 0, lOn = 0, lOff = 0, drops = 0;
    const f = sr.flips, n = f.length;
    for (let k = 0; k <= n; k++) {
      const end = k < n ? f[k] : NH;
      const s0 = start > a ? start : a, e0 = end < b ? end : b;
      if (e0 > s0) {
        const len = e0 - s0;
        if (st) { on += len; if (len > lOn) lOn = len; } else if (len > lOff) lOff = len;
      }
      if (st && k < n && end > a && end < b) drops++;
      start = end; st ^= 1;
      if (start >= b) break;
    }
    return { on, lOn, lOff, drops };
  }
  function andSeries(x, y) {
    let s1 = x.init, s2 = y.init, p = 0, q = 0;
    const f1 = x.flips, f2 = y.flips, out = [];
    let cur = s1 & s2;
    const init = cur;
    while (p < f1.length || q < f2.length) {
      const tt = Math.min(p < f1.length ? f1[p] : Infinity, q < f2.length ? f2[q] : Infinity);
      if (p < f1.length && f1[p] === tt) { s1 ^= 1; p++; }
      if (q < f2.length && f2[q] === tt) { s2 ^= 1; q++; }
      const v = s1 & s2;
      if (v !== cur) { out.push(tt); cur = v; }
    }
    return { init, flips: out };
  }
  function entryStats(entry, m, a, b) {
    const o = m === "t" ? 0 : 2;
    const sun = series(entry, o), earth = series(entry, o + 1);
    const rs = runStats(sun, a, b), re = runStats(earth, a, b), rb = runStats(andSeries(sun, earth), a, b);
    const L = b - a;
    return {
      sun_pct: (100 * rs.on) / L, earth_pct: (100 * re.on) / L, both_pct: (100 * rb.on) / L,
      longest_sun_h: rs.lOn, longest_dark_h: rs.lOff,
      longest_earth_outage_h: re.lOff, earth_interruptions: re.drops,
    };
  }
  function decode(sr, a, b) {
    const out = new Uint8Array(b - a);
    let st = sr.init, start = 0;
    const f = sr.flips;
    for (let k = 0; k <= f.length; k++) {
      const end = k < f.length ? f[k] : NH;
      if (st) { const s0 = Math.max(start, a), e0 = Math.min(end, b); if (e0 > s0) out.fill(1, s0 - a, e0 - a); }
      start = end; st ^= 1;
      if (start >= b) break;
    }
    return out;
  }
  const isFull = () => state.a === 0 && state.b === NH;

  function siteStats(i, m = state.method) {
    if (BIN) return entryStats(i, m, state.a, state.b);
    return m === "t" ? S.sites[i].terrain : S.sites[i].spherical;
  }
  function gridStats(m = state.method) {
    const key = `${state.a}-${state.b}-${m}`;
    if (gridCache.has(key)) return gridCache.get(key);
    let r;
    if (!BIN) {
      r = { sun: G["sun_" + m], earth: G["earth_" + m], both: G["both_" + m], dark: G["dark_" + m] };
      return r;
    }
    const n = G.n;
    r = { sun: new Float32Array(n), earth: new Float32Array(n), both: new Float32Array(n), dark: new Float32Array(n),
          lsun: new Float32Array(n), blackout: new Float32Array(n), drops: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const s = entryStats(5 + i, m, state.a, state.b);
      r.sun[i] = s.sun_pct; r.earth[i] = s.earth_pct; r.both[i] = s.both_pct; r.dark[i] = s.longest_dark_h;
      r.lsun[i] = s.longest_sun_h; r.blackout[i] = s.longest_earth_outage_h; r.drops[i] = s.earth_interruptions;
    }
    gridCache.set(key, r);
    return r;
  }
  function pointStats(i, m = state.method) {
    if (BIN) return entryStats(5 + i, m, state.a, state.b);
    return { sun_pct: G["sun_" + m][i], earth_pct: G["earth_" + m][i], both_pct: G["both_" + m][i], longest_dark_h: G["dark_" + m][i] };
  }

  /* ------------------------------------------------------------ colors */
  function color(v) {
    v = Math.max(0, Math.min(1, v));
    const f = v * (VIRIDIS.length - 1), i = Math.min(VIRIDIS.length - 2, Math.floor(f)), w = f - i;
    const c = VIRIDIS[i].map((a, k) => Math.round(a + (VIRIDIS[i + 1][k] - a) * w));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  const darkCap = () => Math.max(1, Math.min(30, Math.round(rangeLen() / 24)));
  const SLOPE_COL = (d) => (d < 5 ? "#3ddc84" : d < 10 ? "#ffb020" : "#ff5c5c");
  const slopeClass = (d) => (d < 5 ? "ok" : d < 10 ? "warn" : "bad");
  function slopeBadge(d) { return d == null ? "—" : `<span class="sl ${slopeClass(d)}">${fmt(d, 1)}°</span>`; }
  function slopeNote(d) {
    if (d == null || d < 5) return "";
    return d >= 10 ? `<div class="warnbox">⚠ ${t("slopeWarn")}</div>` : `<div class="cautionbox">${t("slopeCaution")}</div>`;
  }
  const psrText = (km, self) => (self ? t("psrInside") : km == null ? "—" : fmt(km, 1) + " km");
  function passes(i, gs) {
    if (X.grid.slope_deg[i] >= filt.slope) return false;
    if (X.grid.psr_km[i] > filt.psr) return false;
    if (filt.sun > 0 && gs.lsun && gs.lsun[i] < filt.sun * 24) return false;
    return true;
  }
  function sitePasses(i, st) {
    const x = X.sites[S.sites[i].id];
    if (x.slope_deg >= filt.slope || x.psr_km > filt.psr) return false;
    if (filt.sun > 0 && st.longest_sun_h != null && st.longest_sun_h < filt.sun * 24) return false;
    return true;
  }
  const filtersOn = () => filt.sun > 0 || filt.slope < 99 || filt.psr < 999;
  function norm(metric, val) {
    if (metric === "psr") return 1 - Math.min(val, 20) / 20;
    if (metric === "dark") { const c = darkCap(); return 1 - Math.min(val / 24, c) / c; }
    return val / VMAX;
  }

  /* ------------------------------------------------------------ map */
  function drawGraticule() {
    const g = $("#graticule");
    g.innerHTML = "";
    g.setAttribute("font-size", 5 * K);
    const lats = state.zoom === "pole" ? [-88.75, -89, -89.25, -89.5, -89.75] : [-84, -85, -86, -87, -88, -89];
    for (const lat of lats) {
      const r = 2 * R_KM * Math.tan(((90 + lat) * Math.PI) / 360);
      el("circle", { cx: 0, cy: 0, r }, g);
      el("text", { x: 1.5 * K, y: -r - 1.5 * K }, g).textContent = fmt(Math.abs(lat), lat % 1 ? 2 : 0) + "°S";
    }
    const half = 200 * K;
    for (let lon = 0; lon < 360; lon += 30) {
      const a = (lon * Math.PI) / 180;
      el("line", { x1: 0, y1: 0, x2: 1.5 * half * Math.sin(a), y2: -1.5 * half * Math.cos(a) }, g);
      el("text", { x: 0.94 * half * Math.sin(a), y: -0.94 * half * Math.cos(a) + 2 * K, "text-anchor": "middle" }, g).textContent = lonLabel(lon);
    }
  }
  function applyZoom() {
    K = state.zoom === "pole" ? 0.2 : 1;
    const h = 200 * K;
    $("#map").setAttribute("viewBox", `${-h} ${-h} ${2 * h} ${2 * h}`);
    $("#poleimg").style.display = state.zoom === "pole" ? "" : "none";
    drawGraticule(); drawSites(); drawPickMarker();
  }
  function drawHeat() {
    const g = $("#heatlayer");
    g.innerHTML = "";
    const frag = document.createDocumentFragment();
    ORDER = [...Array(G.n).keys()].sort((a, b) => G.cell_km[b] - G.cell_km[a]);
    for (const i of ORDER) {
      const c = G.cell_km[i], r = document.createElementNS(NS, "rect");
      r.setAttribute("x", G.x_km[i] - c / 2); r.setAttribute("y", -G.y_km[i] - c / 2);
      r.setAttribute("width", c + 0.05); r.setAttribute("height", c + 0.05);
      frag.appendChild(r);
    }
    g.appendChild(frag);
    g.setAttribute("opacity", 0.55);
    g.setAttribute("pointer-events", "none");
  }
  const metricArray = () => (state.metric === "slope" ? X.grid.slope_deg : state.metric === "psr" ? X.grid.psr_km : gridStats()[state.metric]);
  function updateHeat() {
    const arr = metricArray(), gs = gridStats();
    let mx = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] > mx) mx = arr[i];
    VMAX = Math.max(10, Math.ceil(mx / 10) * 10);
    const rects = $("#heatlayer").children, fo = filtersOn();
    let nMatch = 0;
    for (let k = 0; k < rects.length; k++) {
      const i = ORDER[k], ok = !fo || passes(i, gs);
      if (ok) nMatch++;
      rects[k].setAttribute("fill", state.metric === "slope" ? SLOPE_COL(arr[i]) : color(norm(state.metric, arr[i])));
      rects[k].setAttribute("fill-opacity", ok ? 1 : 0.08);
    }
    $("#fCount").textContent = fo ? t("fCount", { n: nMatch.toLocaleString(locale()), N: G.n.toLocaleString(locale()) }) : "";
    $("#heatlayer").style.display = $("#heat").checked ? "" : "none";
    $("#psrlayer").style.display = $("#psrLayer").checked ? "" : "none";
    const bar = $("#legBar");
    if (state.metric === "slope") {
      bar.style.background = "linear-gradient(90deg,#3ddc84 0 33%,#ffb020 33% 66%,#ff5c5c 66%)";
      $("#legLo").textContent = "0°"; $("#legHi").textContent = "> 10°";
      $("#legLabel").textContent = t("leg_slope");
      return;
    }
    bar.style.background = `linear-gradient(90deg,${[...Array(10).keys()].map((k) => color(k / 9)).join(",")})`;
    if (state.metric === "dark") { $("#legLo").textContent = darkCap() + "+ d"; $("#legHi").textContent = "0 d"; }
    else if (state.metric === "psr") { $("#legLo").textContent = "20+ km"; $("#legHi").textContent = "0 km"; }
    else { $("#legLo").textContent = "0%"; $("#legHi").textContent = VMAX + "%"; }
    $("#legLabel").textContent = state.metric === "psr" ? t("leg_psr") : `${t("leg_" + state.metric)} (${methodName()})`;
  }
  function drawPsr() {
    const g = $("#psrlayer");
    g.innerHTML = "";
    for (let i = 0; i < G.n; i++) {
      if (!X.grid.psr[i]) continue;
      const c = G.cell_km[i];
      el("rect", { x: G.x_km[i] - c / 2, y: -G.y_km[i] - c / 2, width: c + 0.05, height: c + 0.05, fill: "rgba(70,130,255,.55)", stroke: "rgba(150,190,255,.8)", "stroke-width": 0.15 }, g);
    }
    g.setAttribute("pointer-events", "none");
  }
  function drawSites() {
    const g = $("#sitelayer");
    g.innerHTML = "";
    S.sites.forEach((s, i) => {
      const grp = el("g", { class: "site" + (s.id === state.site && state.target === "site" ? " sel" : ""), "data-id": s.id }, g);
      el("circle", { cx: s.x_km, cy: -s.y_km, r: 4.2 * K, class: "ring", fill: "none", "stroke-width": 0.8 * K }, grp);
      el("circle", { cx: s.x_km, cy: -s.y_km, r: 2.6 * K, fill: SITE_COLORS[i], "stroke-width": 0.8 * K }, grp);
      const lp = (state.zoom === "pole" ? null : LABEL_POS[s.id]) || [4, -3.5, "start"];
      el("text", { x: s.x_km + lp[0] * K, y: -s.y_km + lp[1] * K, "text-anchor": lp[2], "font-size": 6 * K, style: `stroke-width:${1.6 * K}px` }, grp).textContent = siteName(s, true);
      grp.addEventListener("click", (ev) => { ev.stopPropagation(); selectSite(s.id, true); });
    });
  }
  function svgPoint(ev) {
    const svg = $("#map"), p = svg.createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return { x: q.x, y: -q.y };
  }
  const toLatLon = (x, y) => {
    const r = Math.hypot(x, y);
    return { lat: -90 + (2 * Math.atan((0.5 * r) / R_KM) * 180) / Math.PI, lon: (((Math.atan2(x, y) * 180) / Math.PI) + 360) % 360 };
  };
  function nearest(x, y) {
    let best = -1, bd = Infinity;
    const inFine = Math.hypot(x, y) <= G.fine_radius_km;
    for (let i = 0; i < G.n; i++) {
      if (inFine && G.cell_km[i] !== G.fine_spacing_km) continue;
      const d = (G.x_km[i] - x) ** 2 + (G.y_km[i] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function drawPickMarker() {
    const g = $("#picklayer");
    g.innerHTML = "";
    if (state.pick == null) return;
    const i = state.pick, x = G.x_km[i], y = -G.y_km[i], k = K, sw = 0.8 * K, a = { stroke: "#fff", "stroke-width": sw };
    el("circle", { cx: x, cy: y, r: 3.5 * k, fill: "none", ...a }, g);
    el("line", { x1: x - 7 * k, y1: y, x2: x - 4 * k, y2: y, ...a }, g);
    el("line", { x1: x + 4 * k, y1: y, x2: x + 7 * k, y2: y, ...a }, g);
    el("line", { x1: x, y1: y - 7 * k, x2: x, y2: y - 4 * k, ...a }, g);
    el("line", { x1: x, y1: y + 4 * k, x2: x, y2: y + 7 * k, ...a }, g);
  }
  function pick(i, openDetail) {
    state.pick = i;
    state.target = "point";
    drawPickMarker(); drawSites(); drawPick(); drawDetail(); drawRanking();
    if (openDetail) $("#pick").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function drawPick() {
    const body = $("#pickBody");
    if (state.pick == null) { body.className = "muted"; body.textContent = t("pickEmpty"); $("#pickBands").hidden = true; $("#pickOpen").hidden = true; return; }
    const i = state.pick, st = pointStats(i, "t"), ss = pointStats(i, "s");
    const cell = (s, k, dark) => (s[k] == null ? "—" : dark ? days(s[k]) : fmt(s[k], 1) + "%");
    const row = (label, k, dark) => `<div>${label}</div><div>${cell(st, k, dark)}</div><div class="muted">${cell(ss, k, dark)}</div>`;
    body.className = "";
    body.innerHTML =
      `<p style="margin:0 0 8px"><b>${latlonText(G.lat[i], G.lon_e[i])}</b> · ${t("pickInfo", { e: G.elev[i], c: fmt(G.cell_km[i], 1) })}</p>
       <div class="kv"><div class="h"></div><div class="h">${t("colTerr")}</div><div class="h">${t("colSph")}</div>
       ${row(t("kSun"), "sun_pct")}${row(t("kEarth"), "earth_pct")}${row(t("kBoth"), "both_pct")}${row(t("cLongSun"), "longest_sun_h", true)}${row(t("cLongDark"), "longest_dark_h", true)}${row(t("cBlackout"), "longest_earth_outage_h", true)}</div>
       <div class="kv" style="margin-top:6px"><div>${t("cSlope")}</div><div>${slopeBadge(X.grid.slope_deg[i])}</div><div class="muted small">LOLA LDSM</div>
       <div>${t("cPsr")}</div><div>${psrText(X.grid.psr_km[i], X.grid.psr[i] === 1)}</div><div></div></div>${slopeNote(X.grid.slope_deg[i])}`;
    $("#pickOpen").hidden = false;
    if (BIN) { $("#pickBands").hidden = false; drawBands($("#pickBands"), 5 + i); }
    else $("#pickBands").hidden = true;
  }
  function bindMap() {
    const svg = $("#map"), tip = $("#tip"), wrap = $(".mapwrap");
    const rmax = 2 * R_KM * Math.tan(((90 + G.max_lat) * Math.PI) / 360);
    svg.addEventListener("click", (ev) => {
      const p = svgPoint(ev);
      if (Math.hypot(p.x, p.y) > rmax + 3) { $("#pickBody").className = "muted"; $("#pickBody").textContent = t("outside"); return; }
      pick(nearest(p.x, p.y), true);
    });
    svg.addEventListener("mousemove", (ev) => {
      const p = svgPoint(ev), ll = toLatLon(p.x, p.y), b = wrap.getBoundingClientRect();
      tip.hidden = false;
      tip.style.left = ev.clientX - b.left + "px";
      tip.style.top = ev.clientY - b.top + "px";
      let txt = latlonText(ll.lat, ll.lon);
      if (Math.hypot(p.x, p.y) <= rmax + 3) {
        const v = metricArray()[nearest(p.x, p.y)];
        txt += ` · ${state.metric === "dark" ? days(v) : state.metric === "slope" ? fmt(v, 1) + "°" : state.metric === "psr" ? fmt(v, 1) + " km" : fmt(v, 1) + "%"}`;
      }
      tip.textContent = txt;
    });
    svg.addEventListener("mouseleave", () => (tip.hidden = true));
  }

  /* ------------------------------------------------------------ ranking */
  function rankedSites() {
    const rows = S.sites.map((s, idx) => ({ s, idx, ...siteStats(idx), slope_deg: X.sites[s.id].slope_deg, psr_km: X.sites[s.id].psr_km }));
    [...rows].sort((a, b) => b.both_pct - a.both_pct || a.longest_dark_h - b.longest_dark_h).forEach((r, k) => (r.rank = k + 1));
    return rows;
  }
  function whySentence(rows) {
    const byRank = [...rows].sort((a, b) => a.rank - b.rank), A = byRank[0], B = byRank[1];
    if (!A || A.both_pct <= 0) return t("whyNone", { range: rangeLabel() });
    let clause = "";
    if (A.longest_dark_h < B.longest_dark_h) clause = t("whyNight", { a: days(A.longest_dark_h), b: days(B.longest_dark_h) });
    else if (A.longest_sun_h > B.longest_sun_h) clause = t("whySun", { a: days(A.longest_sun_h) });
    else if (A.earth_interruptions < B.earth_interruptions) clause = t("whyDrops", { a: A.earth_interruptions, b: B.earth_interruptions });
    else if (A.longest_earth_outage_h < B.longest_earth_outage_h) clause = t("whyBlackout", { a: days(A.longest_earth_outage_h), b: days(B.longest_earth_outage_h) });
    return t("whyMain", { site: siteName(A.s, true), range: rangeLabel(), a: fmt(A.both_pct, 1), b: fmt(B.both_pct, 1), other: siteName(B.s, true), method: methodName() }) + clause + ".";
  }
  function drawRanking() {
    const rows = rankedSites(), key = state.sortKey;
    $("#why").textContent = whySentence(rows);
    rows.sort((a, b) => {
      const va = key === "name" ? siteName(a.s) : key === "rank" ? a.rank : a[key];
      const vb = key === "name" ? siteName(b.s) : key === "rank" ? b.rank : b[key];
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return state.sortAsc ? c : -c;
    });
    const tb = $("#rank tbody");
    tb.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");
      const cls = [];
      if (state.target === "site" && r.s.id === state.site) cls.push("sel");
      if (filtersOn() && !sitePasses(r.idx, r)) cls.push("nomatch");
      tr.className = cls.join(" ");
      tr.innerHTML = `<td>${r.rank}</td><td><span class="dot" style="background:${SITE_COLORS[r.idx]}"></span>${siteName(r.s, true)}</td>
        <td class="num">${fmt(r.sun_pct, 1)}</td><td class="num">${fmt(r.earth_pct, 1)}</td><td class="num"><b>${fmt(r.both_pct, 1)}</b></td>
        <td class="num">${r.longest_sun_h == null ? "—" : days(r.longest_sun_h)}</td><td class="num">${days(r.longest_dark_h)}</td>
        <td class="num">${days(r.longest_earth_outage_h)}</td><td class="num">${r.earth_interruptions == null ? "—" : r.earth_interruptions}</td>
        <td class="num">${slopeBadge(r.slope_deg)}${r.slope_deg >= 10 ? ' <span title="' + t("slopeWarn") + '">⚠</span>' : ""}</td><td class="num">${psrText(r.psr_km, X.sites[r.s.id].psr_self)}</td>`;
      tr.addEventListener("click", () => selectSite(r.s.id, true));
      tb.appendChild(tr);
    }
    $$("#rank th").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.k === key);
      th.classList.toggle("asc", state.sortAsc);
    });
    $$(".methodPill").forEach((p) => (p.textContent = methodName()));
  }
  function drawBest() {
    const gs = gridStats("t");
    const idx = [...Array(G.n).keys()].filter((i) => !filtersOn() || passes(i, gs)).sort((a, b) => gs.both[b] - gs.both[a]);
    const chosen = [];
    for (const i of idx) {
      if (chosen.every((j) => Math.hypot(G.x_km[i] - G.x_km[j], G.y_km[i] - G.y_km[j]) > 6)) chosen.push(i);
      if (chosen.length >= 6) break;
    }
    const ol = $("#best");
    ol.innerHTML = chosen.length ? "" : `<li class="muted">${t("noMatch")}</li>`;
    for (const i of chosen) {
      const li = document.createElement("li");
      li.innerHTML = t("bestItem", { ll: latlonText(G.lat[i], G.lon_e[i]), b: fmt(gs.both[i], 1), s: fmt(gs.sun[i], 1), e: fmt(gs.earth[i], 1) }) + " " + slopeBadge(X.grid.slope_deg[i]);
      li.addEventListener("click", () => pick(i, true));
      ol.appendChild(li);
    }
  }

  /* ------------------------------------------------------------ timeline bands */
  function drawBands(wrap, entry) {
    const m = state.method, o = m === "t" ? 0 : 2, a = state.a, b = state.b;
    const sunS = series(entry, o), earthS = series(entry, o + 1);
    const d = { sun: decode(sunS, a, b), earth: decode(earthS, a, b), a, b };
    d.both = new Uint8Array(d.sun.length);
    for (let i = 0; i < d.sun.length; i++) d.both[i] = d.sun[i] & d.earth[i];
    wrap._d = d;
    renderBands(wrap);
    if (!wrap._bound) {
      wrap._bound = true;
      const cv = wrap.querySelector("canvas"), tip = wrap.querySelector(".btip");
      const move = (ev) => {
        const dd = wrap._d, r = cv.getBoundingClientRect(), L = wrap._L;
        const x = ev.clientX - r.left;
        if (!dd || x < L || x > r.width) { tip.hidden = true; return; }
        const len = dd.b - dd.a, i = Math.min(len - 1, Math.floor(((x - L) / (r.width - L)) * len));
        const yes = (v) => (v ? "✓" : "✗");
        tip.hidden = false;
        tip.style.left = Math.min(Math.max(x, 90), r.width - 90) + "px";
        tip.innerHTML = `<b>${dTime(hourDate(dd.a + i))}</b><br>${t("bSun")} ${yes(dd.sun[i])} · ${t("bEarth")} ${yes(dd.earth[i])} · ${t("bBoth")} ${yes(dd.both[i])}`;
      };
      cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerdown", move);
      cv.addEventListener("pointerleave", () => (tip.hidden = true));
    }
  }
  function renderBands(wrap) {
    const d = wrap._d;
    if (!d) return;
    const cv = wrap.querySelector("canvas"), dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const L = 52; wrap._L = L;
    const axisH = 16, gap = 4, avail = H - axisH - 2 * gap;
    const rows = [["sun", t("bSun"), avail * 0.3], ["earth", t("bEarth"), avail * 0.3], ["both", t("bBoth"), avail * 0.4]];
    const len = d.b - d.a, cols = Math.max(1, Math.floor(W - L));
    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    let y = 0;
    for (const [key, label, h] of rows) {
      const arr = d[key], c = BAND[key], bg = BAND.bg;
      ctx.fillStyle = key === "both" ? "#e6e9ef" : "#8b95a8";
      ctx.font = (key === "both" ? "600 " : "") + "11px system-ui, sans-serif";
      ctx.fillText(label, 2, y + h / 2);
      for (let x = 0; x < cols; x++) {
        const i0 = Math.floor((x * len) / cols), i1 = Math.max(i0 + 1, Math.floor(((x + 1) * len) / cols));
        let s = 0;
        for (let i = i0; i < i1; i++) s += arr[i];
        const f = s / (i1 - i0);
        ctx.fillStyle = `rgb(${Math.round(bg[0] + (c[0] - bg[0]) * f)},${Math.round(bg[1] + (c[1] - bg[1]) * f)},${Math.round(bg[2] + (c[2] - bg[2]) * f)})`;
        ctx.fillRect(L + x, y, 1.02, h);
      }
      if (key === "both") { ctx.strokeStyle = "rgba(199,146,234,.9)"; ctx.lineWidth = 1; ctx.strokeRect(L + 0.5, y + 0.5, cols - 1, h - 1); }
      y += h + gap;
    }
    ctx.fillStyle = "#8b95a8";
    ctx.font = "10px system-ui, sans-serif";
    const nt = Math.max(2, Math.min(7, Math.floor(cols / 90)));
    for (let k = 0; k <= nt; k++) {
      const x = L + (k / nt) * (cols - 1), hh = d.a + Math.min(len - 1, Math.floor((k / nt) * len));
      ctx.textAlign = k === 0 ? "left" : k === nt ? "right" : "center";
      ctx.fillText(dShort(hourDate(hh)), x, H - axisH / 2);
    }
    ctx.textAlign = "left";
  }

  /* ------------------------------------------------------------ launch planner */
  function moonKm(h) { // h = hour index from Jan 1 of YEAR (may be negative)
    const m = X.moon, base = (Date.parse(m.start + "T00:00:00Z") - Date.UTC(YEAR, 0, 1)) / 3600e3;
    const f = (h - base) / 24, i = Math.floor(f), w = f - i;
    if (i < 0 || i + 1 >= m.km.length) return null;
    return m.km[i] * (1 - w) + m.km[i + 1] * w;
  }
  function distBar(km) {
    const lo = X.moon.min.km, hi = X.moon.max.km, pos = (v) => (100 * (v - lo)) / (hi - lo);
    return `<div class="dbar"><span class="dot" style="left:${pos(km).toFixed(1)}%"></span>
      <span style="position:absolute;left:${pos(MEAN_PERIGEE)}%;top:-3px;bottom:-3px;width:1px;background:#fff8"></span>
      <span style="position:absolute;left:${pos(MEAN_APOGEE)}%;top:-3px;bottom:-3px;width:1px;background:#fff8"></span></div>
      <div class="dbar-l"><span style="left:${pos(MEAN_PERIGEE)}%">${t("perigee")}</span><span style="left:${pos(MEAN_APOGEE)}%;transform:translateX(-100%)">${t("apogee")}</span></div>`;
  }
  function drawPlanner(entry) {
    const box = $("#plBody");
    if (!BIN) { box.innerHTML = `<p class="muted small">${t("plLoading")}</p>`; return; }
    const o = state.method === "t" ? 0 : 2;
    const both = andSeries(series(entry, o), series(entry, o + 1));
    const wins = [];
    let st = both.init, start = 0;
    const f = both.flips;
    for (let k = 0; k <= f.length; k++) {
      const end = k < f.length ? f[k] : NH;
      if (st) { const s0 = Math.max(start, state.a), e0 = Math.min(end, state.b); if (e0 > s0) wins.push([s0, e0, start < state.a]); }
      start = end; st ^= 1;
      if (start >= state.b) break;
    }
    if (!wins.length) { box.innerHTML = `<p class="muted">${t("plNone")}</p>`; return; }
    const top = wins.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0])).slice(0, 3).sort((x, y) => x[0] - y[0]);
    box.innerHTML = top.map(([s0, e0, open]) => {
      const dep1 = s0 - 4.5 * 24, dep2 = s0 - 3 * 24, km = moonKm(s0);
      const kmD1 = moonKm(dep1), kmD2 = moonKm(dep2);
      return `<div class="plrow">
        <div><div class="l">${t("plWindow")}</div><b>${dTime(hourDate(s0))}</b><br>→ ${dTime(hourDate(e0))}<br><span class="muted">${days(e0 - s0)}${open ? " · " + t("plOpen") : ""}</span></div>
        <div><div class="l">${t("plDepart")}</div><b>${dShort(hourDate(dep1))} – ${dShort(hourDate(dep2))}${hourDate(dep1).getUTCFullYear() !== YEAR ? " " + hourDate(dep1).getUTCFullYear() : ""}</b><br><span class="muted">${t("plTransit")}</span>
          ${kmD1 != null && kmD2 != null ? `<br><span class="muted">${t("plDistDep", { a: Math.round(kmD1).toLocaleString(locale()), b: Math.round(kmD2).toLocaleString(locale()) })}</span>` : ""}</div>
        <div><div class="l">${t("plDist")}</div>${km != null ? `<b>${Math.round(km).toLocaleString(locale())} km</b>${distBar(km)}` : "—"}</div>
      </div>`;
    }).join("");
  }

  /* ------------------------------------------------------------ detail */
  function selectSite(id, scroll) {
    state.site = id;
    state.target = "site";
    drawSites(); drawRanking(); drawDetail();
    if (scroll) $("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function fillDetailSelect() {
    const sel = $("#dSel");
    sel.innerHTML = "";
    S.sites.forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = siteName(s, true); sel.appendChild(o); });
    if (state.pick != null) { const o = document.createElement("option"); o.value = "__pt"; o.textContent = t("selPoint"); sel.appendChild(o); }
    sel.value = state.target === "point" ? "__pt" : state.site;
  }
  function drawDetail() {
    fillDetailSelect();
    const isPt = state.target === "point" && state.pick != null;
    let st, so, entry, xs;
    const card = (l, v, sub) => `<div class="stat"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`;
    if (isPt) {
      const i = state.pick;
      entry = 5 + i;
      $("#dName").textContent = t("pointName", { ll: latlonText(G.lat[i], G.lon_e[i]) });
      $("#dMeta").textContent = t("dMetaPt", { ll: latlonText(G.lat[i], G.lon_e[i]), e: G.elev[i], c: fmt(G.cell_km[i], 1) });
      st = pointStats(i); so = pointStats(i, state.method === "t" ? "s" : "t");
      xs = { slope: X.grid.slope_deg[i], psr: X.grid.psr_km[i], self: X.grid.psr[i] === 1 };
    } else {
      const idx = S.sites.findIndex((x) => x.id === state.site), s = S.sites[idx];
      if (!s) return;
      entry = idx;
      $("#dName").textContent = siteName(s);
      $("#dMeta").innerHTML = t("dMetaSite", { ll: latlonText(s.lat, s.lon_e), e: fmt(s.elev_m, 0), src: s.source.replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>') });
      st = siteStats(idx); so = siteStats(idx, state.method === "t" ? "s" : "t");
      const xx = X.sites[s.id];
      xs = { slope: xx.slope_deg, psr: xx.psr_km, self: xx.psr_self };
    }
    const pct = (v) => (v == null ? "—" : fmt(v, 1) + "%"), dd = (v) => (v == null ? "—" : days(v));
    const sub = (v) => `${otherMethodName()} ${v}`;
    $("#dStats").innerHTML =
      card(t("cSun"), pct(st.sun_pct), sub(pct(so.sun_pct))) +
      card(t("cEarth"), pct(st.earth_pct), sub(pct(so.earth_pct))) +
      card(t("cBoth"), pct(st.both_pct), sub(pct(so.both_pct))) +
      card(t("cLongSun"), dd(st.longest_sun_h), sub(dd(so.longest_sun_h))) +
      card(t("cLongDark"), dd(st.longest_dark_h), sub(dd(so.longest_dark_h))) +
      card(t("cBlackout"), dd(st.longest_earth_outage_h), sub(dd(so.longest_earth_outage_h))) +
      card(t("cDrops"), st.earth_interruptions == null ? "—" : st.earth_interruptions, sub(so.earth_interruptions == null ? "—" : so.earth_interruptions)) +
      card(t("cSlope"), slopeBadge(xs.slope), "LOLA LDSM_75S_240M") +
      card(t("cPsr"), psrText(xs.psr, xs.self), t("psrSub"));
    $("#dSlopeNote") && $("#dSlopeNote").remove();
    $("#dStats").insertAdjacentHTML("afterend", `<div id="dSlopeNote">${slopeNote(xs.slope)}</div>`);
    drawPlanner(entry);
    if (BIN) drawBands($("#dBands"), entry);
    $("#hzFig").hidden = isPt;
    $("#hzNone").hidden = !isPt;
    if (!isPt) drawHorizon(S.sites[entry]);
  }
  function drawHorizon(s) {
    const svg = $("#hz");
    svg.innerHTML = "";
    const W = 1000, H = 260, L = 38, B = 22, T = 8, Rm = 8;
    const mask = s.horizon_deg, tr = s.track, step = tr.step_h;
    const k0 = Math.ceil(state.a / step), k1 = Math.ceil(state.b / step);
    const sAz = tr.sun_az.slice(k0, k1), sAl = tr.sun_alt.slice(k0, k1), eAz = tr.earth_az.slice(k0, k1), eAl = tr.earth_alt.slice(k0, k1);
    const lo = Math.min(-7.5, Math.min(...mask) - 0.5, Math.min(...tr.earth_alt) - 0.5);
    const hi = Math.max(7.5, Math.max(...mask) + 0.5, Math.max(...tr.earth_alt) + 0.5);
    const X = (az) => L + (az / 360) * (W - L - Rm), Y = (e) => T + ((hi - e) / (hi - lo)) * (H - T - B);
    for (let e = Math.ceil(lo / 2.5) * 2.5; e <= hi; e += 2.5) {
      el("line", { x1: L, x2: W - Rm, y1: Y(e), y2: Y(e), stroke: "#1f2738" }, svg);
      el("text", { x: L - 4, y: Y(e) + 3, "text-anchor": "end" }, svg).textContent = fmt(e, e % 1 ? 1 : 0) + "°";
    }
    I.dirs[state.lang].forEach((d, k) => el("text", { x: X(k * 45), y: H - 6, "text-anchor": "middle" }, svg).textContent = d);
    let pts = `${X(0)},${Y(lo)} `;
    mask.forEach((m, k) => (pts += `${X(k)},${Y(m)} `));
    pts += `${X(360)},${Y(mask[0])} ${X(360)},${Y(lo)}`;
    el("polygon", { points: pts, fill: "rgba(154,166,189,.28)", stroke: "#9aa6bd", "stroke-width": 1.2 }, svg);
    el("line", { x1: L, x2: W - Rm, y1: Y(0), y2: Y(0), stroke: "#ff6b6b", "stroke-dasharray": "4 3" }, svg);
    const dots = (az, alt, c) => {
      let d = "";
      for (let k = 0; k < az.length; k++) d += `M${X(az[k]).toFixed(1)} ${Y(alt[k]).toFixed(1)}h1.6`;
      if (d) el("path", { d, stroke: c, "stroke-width": 1.8, "stroke-linecap": "round", opacity: 0.85 }, svg);
    };
    dots(eAz, eAl, "#5ad1a8");
    dots(sAz, sAl, "#ffd166");
  }

  /* ------------------------------------------------------------ date range */
  const dayIndex = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.UTC(YEAR, 0, 1)) / 864e5);
  const isoOfDay = (d) => new Date(Date.UTC(YEAR, 0, 1) + d * 864e5).toISOString().slice(0, 10);
  function presets() {
    const out = [["full", t("pFull", { y: YEAR }), 0, NH / 24 - 1]];
    for (let q = 0; q < 4; q++) out.push(["q" + q, t("pQ" + (q + 1)), dayIndex(isoOfDayFromMonth(q * 3)), dayIndex(isoOfDayFromMonth(q * 3 + 3)) - 1]);
    for (let mth = 0; mth < 12; mth++) {
      const name = new Date(Date.UTC(YEAR, mth, 1)).toLocaleDateString(locale(), { month: "long", timeZone: "UTC" });
      out.push(["m" + mth, name.charAt(0).toUpperCase() + name.slice(1), dayIndex(isoOfDayFromMonth(mth)), dayIndex(isoOfDayFromMonth(mth + 1)) - 1]);
    }
    return out;
  }
  function isoOfDayFromMonth(m) { return new Date(Date.UTC(YEAR, m, 1)).toISOString().slice(0, 10); }
  function fillPresets() {
    const sel = $("#preset");
    const cur = sel.value || "full";
    sel.innerHTML = "";
    for (const [v, label] of presets()) { const o = document.createElement("option"); o.value = v; o.textContent = label; sel.appendChild(o); }
    const o = document.createElement("option"); o.value = "custom"; o.textContent = t("pCustom"); sel.appendChild(o);
    sel.value = cur;
  }
  function setRange(d0, d1, fromPreset) {
    const maxD = NH / 24 - 1;
    d0 = Math.max(0, Math.min(maxD, d0)); d1 = Math.max(0, Math.min(maxD, d1));
    if (d1 < d0) [d0, d1] = [d1, d0];
    state.a = d0 * 24; state.b = (d1 + 1) * 24;
    $("#d0").value = isoOfDay(d0); $("#d1").value = isoOfDay(d1);
    if (!fromPreset) {
      const m = presets().find((p) => p[2] === d0 && p[3] === d1);
      $("#preset").value = m ? m[0] : "custom";
    }
    renderAll();
  }
  function bindRange() {
    $("#preset").addEventListener("change", () => {
      const p = presets().find((x) => x[0] === $("#preset").value);
      if (p) setRange(p[2], p[3], true);
    });
    const onDate = () => {
      const a = dayIndex($("#d0").value), b = dayIndex($("#d1").value);
      if (Number.isFinite(a) && Number.isFinite(b)) setRange(a, b, false);
    };
    $("#d0").addEventListener("change", onDate);
    $("#d1").addEventListener("change", onDate);
  }

  /* ------------------------------------------------------------ init */
  function renderAll() {
    const dN = rangeLen() / 24;
    $("#rangeInfo").textContent = t("rangeInfo", { n: dN, h: rangeLen() });
    const ready = BIN != null;
    $("#d0").disabled = $("#d1").disabled = $("#preset").disabled = !ready;
    updateHeat(); drawRanking(); drawBest(); drawPick(); drawDetail(); drawSites(); drawGraticule();
  }
  function bindControls() {
    $$("[data-method]").forEach((b) => b.addEventListener("click", () => {
      state.method = b.dataset.method;
      $$("[data-method]").forEach((x) => x.classList.toggle("on", x === b));
      renderAll();
    }));
    $$("[data-metric]").forEach((b) => b.addEventListener("click", () => {
      state.metric = b.dataset.metric;
      $$("[data-metric]").forEach((x) => x.classList.toggle("on", x === b));
      updateHeat();
    }));
    $$("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
      state.zoom = b.dataset.zoom;
      $$("[data-zoom]").forEach((x) => x.classList.toggle("on", x === b));
      applyZoom();
    }));
    $$("[data-lang]").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));
    $("#heat").addEventListener("change", updateHeat);
    $("#psrLayer").addEventListener("change", updateHeat);
    for (const [id, k] of [["#fSun", "sun"], ["#fSlope", "slope"], ["#fPsr", "psr"]]) {
      $(id).addEventListener("change", () => { filt[k] = Number($(id).value); updateHeat(); drawBest(); drawRanking(); });
    }
    $$("#rank th").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (state.sortKey === k) state.sortAsc = !state.sortAsc;
      else { state.sortKey = k; state.sortAsc = ["name", "rank", "longest_dark_h", "longest_earth_outage_h", "earth_interruptions", "slope_deg", "psr_km"].includes(k); }
      drawRanking();
    }));
    $("#dSel").addEventListener("change", () => {
      const v = $("#dSel").value;
      if (v === "__pt") { state.target = "point"; drawSites(); drawRanking(); drawDetail(); }
      else selectSite(v, false);
    });
    $("#pickOpen").addEventListener("click", () => { state.target = "point"; drawDetail(); $("#detail").scrollIntoView({ behavior: "smooth", block: "start" }); });
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { renderBands($("#dBands")); renderBands($("#pickBands")); }, 120); });
  }
  function fillMeta() {
    const m = S.meta;
    $$("[data-year]").forEach((e) => (e.textContent = m.year));
    $$("[data-nhours]").forEach((e) => (e.textContent = m.n_hours));
    $$(".gridN").forEach((e) => (e.textContent = G.n.toLocaleString(locale())));
    if (m.validation_max_alt_diff_deg != null) $$(".valDiff").forEach((e) => (e.textContent = t("within", { v: m.validation_max_alt_diff_deg })));
    $$(".rayKm").forEach((e) => (e.textContent = m.horizon.ray_max_km));
    $$(".obsH").forEach((e) => (e.textContent = m.horizon.observer_height_m));
    $$(".nPsr").forEach((e) => (e.textContent = X.meta.n_psr_points.toLocaleString(locale())));
  }

  captureEnglish();
  let initLang = "en";
  try {
    const q = new URLSearchParams(location.search).get("lang");
    initLang = q === "es" || q === "en" ? q : localStorage.getItem("pw-lang") || "en";
  } catch (e) { /* ignore */ }
  if (initLang !== "en") applyLang(initLang);

  const t0 = performance.now();
  Promise.all([fetch("data/sites.json").then((r) => r.json()), fetch("data/grid.json").then((r) => r.json()), fetch("data/extras.json").then((r) => r.json())])
    .then(([s, g, x]) => {
      S = s; G = g; X = x; YEAR = S.meta.year; NH = S.meta.n_hours; state.b = NH;
      fillMeta(); fillPresets(); drawGraticule(); drawHeat(); drawPsr(); drawSites(); bindMap(); bindControls(); bindRange();
      const top = [...S.sites].map((x, i) => [x, i]).sort((a, b) => b[0].terrain.both_pct - a[0].terrain.both_pct)[0][0];
      state.site = top.id; state.target = "site";
      renderAll();
      window.__pwInteractiveMs = performance.now() - t0;
      return fetch("data/hourly.bin").then((r) => { if (!r.ok) throw new Error("hourly.bin " + r.status); return r.arrayBuffer(); });
    })
    .then((buf) => {
      parseBin(buf);
      gridCache.clear();
      const ls = $("#loadState");
      ls.dataset.i18n = "loaded"; ls.classList.remove("warn");
      ls.textContent = state.lang === "es" ? I.es.loaded : "Hourly data loaded";
      EN_STATIC.loaded = "Hourly data loaded";
      renderAll();
      window.__pwHourlyMs = performance.now() - t0;
    })
    .catch((err) => {
      document.querySelector(".hero").insertAdjacentHTML("beforeend", `<p style="color:#ff6b6b">Could not load data: ${String(err)}</p>`);
    });
})();
