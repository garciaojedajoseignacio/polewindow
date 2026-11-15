/* PoleWindow static front end. Plain JS, no dependencies. */
(() => {
  "use strict";
  const R_KM = 1737.4;
  const SITE_COLORS = ["#ffd166", "#ff8fab", "#7cc4ff", "#5ad1a8", "#c792ea"];
  const VIRIDIS = [[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];
  const NS = "http://www.w3.org/2000/svg";
  const state = { zoom: "full", method: "t", metric: "both", sortKey: "both_pct", sortAsc: false, site: null, pick: null };
  let S, G, K = 1, VMAX = 100, ORDER = [];
  const LABEL_POS = { connecting_ridge: [-4, -3, "end"], shackleton_center: [3, -4.5, "start"], peak_near_shackleton: [4, 6.5, "start"] };

  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const fmt = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
  const days = (h) => (h >= 8760 ? "all year" : h >= 48 ? (h / 24).toFixed(1) + " d" : h + " h");
  const shortName = (n) => n.replace(/\s*\(.*\)\s*/, "");
  const lonLabel = (lon) => {
    lon = ((lon % 360) + 360) % 360;
    if (lon === 0) return "0°";
    if (lon === 180) return "180°";
    return lon < 180 ? lon + "°E" : (360 - lon) + "°W";
  };
  const latlonText = (lat, lon) => `${Math.abs(lat).toFixed(3)}°S, ${(((lon % 360) + 360) % 360).toFixed(2)}°E`;

  function color(v) { // v in 0..1
    v = Math.max(0, Math.min(1, v));
    const f = v * (VIRIDIS.length - 1), i = Math.min(VIRIDIS.length - 2, Math.floor(f)), w = f - i;
    const c = VIRIDIS[i].map((a, k) => Math.round(a + (VIRIDIS[i + 1][k] - a) * w));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  const DARK_CAP_D = 30;
  function norm(metric, val) {
    if (metric === "dark") return 1 - Math.min(val / 24, DARK_CAP_D) / DARK_CAP_D;
    return val / VMAX;
  }
  const siteStats = (s) => (state.method === "t" ? s.terrain : s.spherical);
  const methodName = () => (state.method === "t" ? "terrain" : "spherical");

  /* ------------------------------------------------------------ map */
  function drawGraticule() {
    const g = $("#graticule");
    g.innerHTML = "";
    g.setAttribute("font-size", 5 * K);
    const lats = state.zoom === "pole" ? [-88.75, -89, -89.25, -89.5, -89.75] : [-84, -85, -86, -87, -88, -89];
    for (const lat of lats) {
      const r = 2 * R_KM * Math.tan(((90 + lat) * Math.PI) / 360);
      el("circle", { cx: 0, cy: 0, r }, g);
      const t = el("text", { x: 1.5 * K, y: -r - 1.5 * K }, g);
      t.textContent = Math.abs(lat) + "°S";
    }
    const half = 200 * K;
    for (let lon = 0; lon < 360; lon += 30) {
      const a = (lon * Math.PI) / 180;
      el("line", { x1: 0, y1: 0, x2: 1.5 * half * Math.sin(a), y2: -1.5 * half * Math.cos(a) }, g);
      const t = el("text", { x: 0.94 * half * Math.sin(a), y: -0.94 * half * Math.cos(a) + 2 * K, "text-anchor": "middle" }, g);
      t.textContent = lonLabel(lon);
    }
  }

  function applyZoom() {
    K = state.zoom === "pole" ? 0.2 : 1;
    const h = 200 * K;
    $("#map").setAttribute("viewBox", `${-h} ${-h} ${2 * h} ${2 * h}`);
    $("#poleimg").style.display = state.zoom === "pole" ? "" : "none";
    drawGraticule(); drawSites();
    if (state.pick != null) pick(state.pick);
    document.querySelectorAll(".site").forEach((g) => g.classList.toggle("sel", g.dataset.id === state.site));
  }

  function drawHeat() {
    const g = $("#heatlayer");
    g.innerHTML = "";
    const frag = document.createDocumentFragment();
    ORDER = [...Array(G.n).keys()].sort((a, b) => G.cell_km[b] - G.cell_km[a]); // fine cells on top
    for (const i of ORDER) {
      const c = G.cell_km[i];
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", G.x_km[i] - c / 2);
      r.setAttribute("y", -G.y_km[i] - c / 2);
      r.setAttribute("width", c + 0.05);
      r.setAttribute("height", c + 0.05);
      frag.appendChild(r);
    }
    g.appendChild(frag);
    g.setAttribute("opacity", 0.55);
    g.setAttribute("pointer-events", "none");
    updateHeat();
  }

  function metricArray() {
    return G[state.metric + "_" + state.method];
  }

  function updateHeat() {
    const arr = metricArray();
    VMAX = state.metric === "dark" ? 100 : Math.max(10, Math.ceil(Math.max(...arr) / 10) * 10);
    const rects = $("#heatlayer").children;
    for (let k = 0; k < rects.length; k++) rects[k].setAttribute("fill", color(norm(state.metric, arr[ORDER[k]])));
    $("#heatlayer").style.display = $("#heat").checked ? "" : "none";
    const stops = [...Array(10).keys()].map((k) => color(k / 9)).join(",");
    $("#legBar").style.background = `linear-gradient(90deg,${stops})`;
    const labels = { both: "Sun + Earth visible, % of year", sun: "Sun visible, % of year", earth: "Earth visible, % of year", dark: "Longest continuous night" };
    if (state.metric === "dark") { $("#legLo").textContent = DARK_CAP_D + "+ d"; $("#legHi").textContent = "0 d"; }
    else { $("#legLo").textContent = "0%"; $("#legHi").textContent = VMAX + "%"; }
    $("#legLabel").textContent = `${labels[state.metric]} (${methodName()})`;
  }

  function drawSites() {
    const g = $("#sitelayer");
    g.innerHTML = "";
    S.sites.forEach((s, i) => {
      const grp = el("g", { class: "site", "data-id": s.id }, g);
      el("circle", { cx: s.x_km, cy: -s.y_km, r: 4.2 * K, class: "ring", fill: "none", "stroke-width": 0.8 * K }, grp);
      el("circle", { cx: s.x_km, cy: -s.y_km, r: 2.6 * K, fill: SITE_COLORS[i], "stroke-width": 0.8 * K }, grp);
      const lp = (state.zoom === "pole" ? null : LABEL_POS[s.id]) || [4, -3.5, "start"];
      const t = el("text", { x: s.x_km + lp[0] * K, y: -s.y_km + lp[1] * K, "text-anchor": lp[2], "font-size": 6 * K, style: `stroke-width:${1.6 * K}px` }, grp);
      t.textContent = shortName(s.name);
      grp.addEventListener("click", (ev) => { ev.stopPropagation(); selectSite(s.id, true); });
    });
  }

  function svgPoint(ev) {
    const svg = $("#map");
    const p = svg.createSVGPoint();
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
    return { i: best, d: Math.sqrt(bd) };
  }

  function pick(i) {
    state.pick = i;
    const g = $("#picklayer");
    g.innerHTML = "";
    const x = G.x_km[i], y = -G.y_km[i];
    const k = K, sw = 0.8 * K;
    el("circle", { cx: x, cy: y, r: 3.5 * k, fill: "none", stroke: "#fff", "stroke-width": sw }, g);
    el("line", { x1: x - 7 * k, y1: y, x2: x - 4 * k, y2: y, stroke: "#fff", "stroke-width": sw }, g);
    el("line", { x1: x + 4 * k, y1: y, x2: x + 7 * k, y2: y, stroke: "#fff", "stroke-width": sw }, g);
    el("line", { x1: x, y1: y - 7 * k, x2: x, y2: y - 4 * k, stroke: "#fff", "stroke-width": sw }, g);
    el("line", { x1: x, y1: y + 4 * k, x2: x, y2: y + 7 * k, stroke: "#fff", "stroke-width": sw }, g);
    const row = (label, k, dark) => {
      const t = G[k + "_t"][i], s = G[k + "_s"][i];
      return `<div>${label}</div><div>${dark ? days(t) : fmt(t, 1) + "%"}</div><div class="muted">${dark ? days(s) : fmt(s, 1) + "%"}</div>`;
    };
    $("#pickBody").className = "";
    $("#pickBody").innerHTML =
      `<p style="margin:0 0 8px"><b>${latlonText(G.lat[i], G.lon_e[i])}</b> · LOLA elevation ${G.elev[i]} m · grid cell ${G.cell_km[i]} km</p>
       <div class="kv"><div class="h"></div><div class="h">Terrain</div><div class="h">Spherical</div>
       ${row("Sun", "sun")}${row("Earth", "earth")}${row("Sun + Earth", "both")}${row("Longest night", "dark", true)}</div>`;
  }

  function bindMap() {
    const svg = $("#map"), tip = $("#tip"), wrap = $(".mapwrap");
    const rmax = 2 * R_KM * Math.tan(((90 + G.max_lat) * Math.PI) / 360);
    svg.addEventListener("click", (ev) => {
      const p = svgPoint(ev);
      if (Math.hypot(p.x, p.y) > rmax + 3) {
        $("#pickBody").className = "muted";
        $("#pickBody").textContent = "Outside the precomputed grid (84°S to the pole). Click closer to the center.";
        return;
      }
      pick(nearest(p.x, p.y).i);
    });
    svg.addEventListener("mousemove", (ev) => {
      const p = svgPoint(ev), ll = toLatLon(p.x, p.y);
      const b = wrap.getBoundingClientRect();
      tip.hidden = false;
      tip.style.left = ev.clientX - b.left + "px";
      tip.style.top = ev.clientY - b.top + "px";
      let txt = latlonText(ll.lat, ll.lon);
      if (Math.hypot(p.x, p.y) <= rmax + 3) {
        const n = nearest(p.x, p.y).i, v = metricArray()[n];
        txt += ` · ${state.metric === "dark" ? days(v) : fmt(v, 1) + "%"}`;
      }
      tip.textContent = txt;
    });
    svg.addEventListener("mouseleave", () => (tip.hidden = true));
  }

  /* ------------------------------------------------------------ ranking */
  function drawRanking() {
    const rows = S.sites.map((s, idx) => ({ s, idx, ...siteStats(s) }));
    const byBoth = [...rows].sort((a, b) => b.both_pct - a.both_pct);
    byBoth.forEach((r, k) => (r.rank = k + 1));
    const key = state.sortKey;
    rows.sort((a, b) => {
      const va = key === "name" ? a.s.name : a[key], vb = key === "name" ? b.s.name : b[key];
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return state.sortAsc ? c : -c;
    });
    const tb = $("#rank tbody");
    tb.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.dataset.id = r.s.id;
      if (r.s.id === state.site) tr.className = "sel";
      tr.innerHTML = `<td>${r.rank}</td><td><span class="dot" style="background:${SITE_COLORS[r.idx]}"></span>${shortName(r.s.name)}</td>
        <td class="num">${fmt(r.sun_pct, 1)}</td><td class="num">${fmt(r.earth_pct, 1)}</td><td class="num"><b>${fmt(r.both_pct, 1)}</b></td><td class="num">${days(r.longest_dark_h)}</td>`;
      tr.addEventListener("click", () => selectSite(r.s.id, true));
      tb.appendChild(tr);
    }
    document.querySelectorAll("#rank th").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.k === key || (key === "rank" && th.dataset.k === "rank"));
      th.classList.toggle("asc", state.sortAsc);
    });
    $("#methodPill").textContent = methodName();
  }

  function drawBest() {
    const idx = [...Array(G.n).keys()].sort((a, b) => G.both_t[b] - G.both_t[a]);
    const chosen = [];
    for (const i of idx) {
      if (chosen.every((j) => Math.hypot(G.x_km[i] - G.x_km[j], G.y_km[i] - G.y_km[j]) > 6)) chosen.push(i);
      if (chosen.length >= 6) break;
    }
    const ol = $("#best");
    ol.innerHTML = "";
    for (const i of chosen) {
      const li = document.createElement("li");
      li.innerHTML = `${latlonText(G.lat[i], G.lon_e[i])} — <b>${fmt(G.both_t[i], 1)}%</b> both <span class="muted">(Sun ${fmt(G.sun_t[i], 1)}%, Earth ${fmt(G.earth_t[i], 1)}%)</span>`;
      li.addEventListener("click", () => { pick(i); $("#pick").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
      ol.appendChild(li);
    }
  }

  /* ------------------------------------------------------------ detail */
  function selectSite(id, scroll) {
    state.site = id;
    document.querySelectorAll(".site").forEach((g) => g.classList.toggle("sel", g.dataset.id === id));
    $("#dSel").value = id;
    drawRanking();
    drawDetail();
    if (scroll) $("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function drawDetail() {
    const s = S.sites.find((x) => x.id === state.site);
    if (!s) return;
    $("#dName").textContent = s.name;
    $("#dMeta").innerHTML = `${latlonText(s.lat, s.lon_e)} · LOLA elevation ${fmt(s.elev_m, 0)} m (relative to 1737.4 km) · Source: ${s.source.replace(/(https?:\/\/\S+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')}`;
    const t = s.terrain, sp = s.spherical;
    const card = (l, v, sub) => `<div class="stat"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`;
    $("#dStats").innerHTML =
      card("Sun visible (terrain)", fmt(t.sun_pct, 1) + "%", `spherical ${fmt(sp.sun_pct, 1)}%`) +
      card("Earth visible (terrain)", fmt(t.earth_pct, 1) + "%", `spherical ${fmt(sp.earth_pct, 1)}%`) +
      card("Sun + Earth (terrain)", fmt(t.both_pct, 1) + "%", `spherical ${fmt(sp.both_pct, 1)}%`) +
      card("Longest night (terrain)", days(t.longest_dark_h), `spherical ${days(sp.longest_dark_h)}`) +
      card("Longest Earth outage", days(t.longest_earth_outage_h), `spherical ${days(sp.longest_earth_outage_h)}`);
    drawHorizon(s);
    drawTimeline(s);
  }

  function drawHorizon(s) {
    const svg = $("#hz");
    svg.innerHTML = "";
    const W = 720, H = 260, L = 34, B = 22, T = 8, Rm = 6;
    const mask = s.horizon_deg;
    const tr = s.track;
    let lo = Math.min(-7.5, Math.min(...mask) - 0.5, Math.min(...tr.earth_alt) - 0.5);
    let hi = Math.max(7.5, Math.max(...mask) + 0.5, Math.max(...tr.earth_alt) + 0.5);
    const X = (az) => L + (az / 360) * (W - L - Rm);
    const Y = (e) => T + ((hi - e) / (hi - lo)) * (H - T - B);
    for (let e = Math.ceil(lo / 2.5) * 2.5; e <= hi; e += 2.5) {
      el("line", { x1: L, x2: W - Rm, y1: Y(e), y2: Y(e), stroke: "#1f2738" }, svg);
      el("text", { x: L - 4, y: Y(e) + 3, "text-anchor": "end" }, svg).textContent = e + "°";
    }
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"].forEach((d, k) => {
      el("text", { x: X(k * 45), y: H - 6, "text-anchor": "middle" }, svg).textContent = d;
    });
    let pts = `${X(0)},${Y(lo)} `;
    mask.forEach((m, k) => (pts += `${X(k)},${Y(m)} `));
    pts += `${X(360)},${Y(mask[0])} ${X(360)},${Y(lo)}`;
    el("polygon", { points: pts, fill: "rgba(154,166,189,.28)", stroke: "#9aa6bd", "stroke-width": 1.2 }, svg);
    el("line", { x1: L, x2: W - Rm, y1: Y(0), y2: Y(0), stroke: "#ff6b6b", "stroke-dasharray": "4 3", "stroke-width": 1 }, svg);
    const dots = (az, alt, c) => {
      let d = "";
      for (let k = 0; k < az.length; k++) d += `M${X(az[k]).toFixed(1)} ${Y(alt[k]).toFixed(1)}h1.6`;
      el("path", { d, stroke: c, "stroke-width": 1.6, "stroke-linecap": "round", opacity: 0.8 }, svg);
    };
    dots(tr.earth_az, tr.earth_alt, "#5ad1a8");
    dots(tr.sun_az, tr.sun_alt, "#ffd166");
  }

  function bits(b64, n) {
    const raw = atob(b64), out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = (raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
    return out;
  }

  function drawTimeline(s) {
    const m = state.method, n = S.meta.n_hours, nd = Math.floor(n / 24);
    const sun = bits(s.hourly_b64["sun_" + m], n), earth = bits(s.hourly_b64["earth_" + m], n);
    const cv = $("#tl");
    cv.width = nd; cv.height = 24;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(nd, 24);
    const C = { 3: [199, 146, 234], 1: [255, 209, 102], 2: [90, 209, 168], 0: [26, 33, 48] };
    let both = 0;
    for (let d = 0; d < nd; d++) for (let h = 0; h < 24; h++) {
      const i = d * 24 + h, code = sun[i] | (earth[i] << 1), c = C[code], p = (h * nd + d) * 4;
      if (code === 3) both++;
      img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    $("#months").innerHTML = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((x) => `<span>${x}</span>`).join("");
    $("#tlMethod").textContent = methodName();
    $("#tlSum").textContent = `· Sun + Earth ${both} h of ${n}`;
  }

  /* ------------------------------------------------------------ init */
  function bindControls() {
    document.querySelectorAll("[data-method]").forEach((b) => b.addEventListener("click", () => {
      state.method = b.dataset.method;
      document.querySelectorAll("[data-method]").forEach((x) => x.classList.toggle("on", x === b));
      updateHeat(); drawRanking(); if (state.site) drawTimeline(S.sites.find((x) => x.id === state.site));
    }));
    document.querySelectorAll("[data-metric]").forEach((b) => b.addEventListener("click", () => {
      state.metric = b.dataset.metric;
      document.querySelectorAll("[data-metric]").forEach((x) => x.classList.toggle("on", x === b));
      updateHeat();
    }));
    $("#heat").addEventListener("change", updateHeat);
    document.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
      state.zoom = b.dataset.zoom;
      document.querySelectorAll("[data-zoom]").forEach((x) => x.classList.toggle("on", x === b));
      applyZoom();
    }));
    document.querySelectorAll("#rank th").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.k === "rank" ? "both_pct" : th.dataset.k;
      if (state.sortKey === k) state.sortAsc = !state.sortAsc;
      else { state.sortKey = k; state.sortAsc = k === "name" || k === "longest_dark_h"; }
      drawRanking();
    }));
    const sel = $("#dSel");
    S.sites.forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = shortName(s.name); sel.appendChild(o); });
    sel.addEventListener("change", () => selectSite(sel.value, false));
  }

  function fillMeta() {
    const m = S.meta;
    document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = m.year));
    document.querySelectorAll("[data-nhours]").forEach((e) => (e.textContent = m.n_hours));
    $("#gridN").textContent = G.n.toLocaleString("en-US");
    if (m.validation_max_alt_diff_deg != null) $("#valDiff").textContent = "within " + m.validation_max_alt_diff_deg;
    $("#rayKm").textContent = m.horizon.ray_max_km;
    $("#obsH").textContent = m.horizon.observer_height_m;
  }

  Promise.all([fetch("data/sites.json").then((r) => r.json()), fetch("data/grid.json").then((r) => r.json())])
    .then(([s, g]) => {
      S = s; G = g;
      fillMeta(); drawGraticule(); drawHeat(); drawSites(); bindMap(); bindControls();
      drawBest();
      const top = [...S.sites].sort((a, b) => b.terrain.both_pct - a.terrain.both_pct)[0];
      selectSite(top.id, false);
    })
    .catch((err) => {
      document.querySelector(".hero").insertAdjacentHTML("beforeend", `<p style="color:#ff6b6b">Could not load data: ${String(err)}</p>`);
    });
})();
