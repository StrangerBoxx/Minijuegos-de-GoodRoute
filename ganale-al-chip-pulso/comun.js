/* comun.js — base compartida de los minijuegos de GoodRoute (Control Position).
 * Ciudad en grilla con edificios (manzanas unidas) y calles cortadas, caminos más cortos, rutas óptimas
 * (Held-Karp), dibujo en canvas, ranking y utilidades del modo stand.
 * Este archivo es igual en las carpetas de todos los juegos.
 */
(() => {
  "use strict";
  const C = {};

  C.COLORES_TECNICOS = ["#033E84", "#27945c", "#7c54c9"];
  C.NOMBRES_TECNICOS = ["Ana", "Pedro", "Luis"];
  C.COLOR = {
    calle: "#FBF6F6", manzana: "#ece4e4", manzanaBorde: "#e2d8d8",
    edificio: "#e3d7d7", edificioBorde: "#d3c5c5",
    gr: "#e07419", gris: "#9a968c", tarde: "#d8442f", aviso: "#d9930c",
    obra: "#d9930c", blanco: "#ffffff", base: "#1c1a1b", texto: "#1c1a1b", acento: "#033E84",
  };

  // ---------- Utilidades ----------
  C.azar = (n) => Math.floor(Math.random() * n);
  C.barajar = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = C.azar(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  C.bits = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  /** Minutos desde las 8:00 → "HH:MM". */
  C.hhmm = (min) => {
    const t = Math.round(8 * 60 + min);
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  };
  C.km = (cuadras, kmPorCuadra) => (cuadras * kmPorCuadra).toFixed(1).replace(".", ",");
  C.escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  C.vertical = () => innerHeight > innerWidth * 1.1;

  // ---------- Ciudad ----------
  /** Formas de los edificios, en manzanas (ancho × alto). Las repetidas salen más seguido. */
  C.FORMAS_EDIFICIO = [[2, 1], [1, 2], [2, 1], [1, 2], [2, 2], [2, 2], [3, 1], [1, 3]];

  /**
   * Grilla de calles con edificios y obras, sin dejar zonas aisladas.
   * - Edificios: manzanas vecinas unidas (2×1, 2×2, 3×1…). La calle entre ellas
   *   desaparece (m.cerradas) y los cruces que quedan adentro no se usan (m.interiores).
   *   Por defecto, uno por cada ~9 manzanas.
   * - Obras: calles cortadas (m.bloqueadas), que se dibujan como barreras.
   * Con { datos } (de C.datosCiudad) no genera nada: arma la misma ciudad,
   * por ejemplo en el celular de un jugador.
   */
  C.crearCiudad = function ({ cols, rows, obras = 0, edificios, datos }) {
    if (datos) ({ cols, rows } = datos);
    const m = { cols, rows, bloqueadas: new Set(), cerradas: new Set(), interiores: new Set(), edificios: [], _bfs: new Map() };
    m.id = (c, r) => r * cols + c;
    m.col = (n) => n % cols;
    m.fila = (n) => Math.floor(n / cols);
    const clave = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
    const vecinos = (n) => {
      const c = m.col(n), r = m.fila(n), out = [];
      if (c > 0) out.push(n - 1);
      if (c < cols - 1) out.push(n + 1);
      if (r > 0) out.push(n - cols);
      if (r < rows - 1) out.push(n + cols);
      return out.filter((v) => !m.bloqueadas.has(clave(n, v)) && !m.cerradas.has(clave(n, v)));
    };
    const bfs = (origen) => {
      const total = cols * rows;
      const dist = new Array(total).fill(Infinity), padre = new Array(total).fill(-1);
      dist[origen] = 0;
      const cola = [origen];
      for (let i = 0; i < cola.length; i++) {
        const n = cola[i];
        for (const v of vecinos(n)) if (dist[v] === Infinity) { dist[v] = dist[n] + 1; padre[v] = n; cola.push(v); }
      }
      return { dist, padre };
    };
    // Toda la ciudad alcanzable desde la esquina 0, salvo los cruces dentro de edificios.
    const conectada = () => bfs(0).dist.every((d, n) => d < Infinity || m.interiores.has(n));

    if (datos) {
      (datos.bloqueadas || []).forEach((k) => m.bloqueadas.add(k));
      (datos.cerradas || []).forEach((k) => m.cerradas.add(k));
      (datos.interiores || []).forEach((n) => m.interiores.add(n));
      m.edificios = (datos.edificios || []).map(({ k, r, w, h }) => {
        const manzanas = [];
        for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) manzanas.push(m.id(k + i, r + j));
        return { k, r, w, h, manzanas };
      });
    } else {
    const nEdificios = edificios ?? Math.round(((cols - 1) * (rows - 1)) / 9);
    const ocupadas = new Set();
    let intentos = 0;
    while (m.edificios.length < nEdificios && intentos++ < 400) {
      const [w, h] = C.FORMAS_EDIFICIO[C.azar(C.FORMAS_EDIFICIO.length)];
      if (w > cols - 1 || h > rows - 1) continue;
      const k = C.azar(cols - w), r = C.azar(rows - h);
      const manzanas = [], aristas = [], internos = [];
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
        manzanas.push(m.id(k + i, r + j));      // cada manzana se identifica por su esquina superior izquierda
        if (i < w - 1) aristas.push(clave(m.id(k + i + 1, r + j), m.id(k + i + 1, r + j + 1)));
        if (j < h - 1) aristas.push(clave(m.id(k + i, r + j + 1), m.id(k + i + 1, r + j + 1)));
        if (i > 0 && j > 0) internos.push(m.id(k + i, r + j));
      }
      if (manzanas.some((n) => ocupadas.has(n))) continue;
      aristas.forEach((a) => m.cerradas.add(a)); internos.forEach((n) => m.interiores.add(n));
      if (!conectada()) { aristas.forEach((a) => m.cerradas.delete(a)); internos.forEach((n) => m.interiores.delete(n)); continue; }
      manzanas.forEach((n) => ocupadas.add(n));
      m.edificios.push({ k, r, w, h, manzanas });
    }

    intentos = 0;
    while (m.bloqueadas.size < obras && intentos++ < 500) {
      const n = C.azar(cols * rows);
      const op = [];
      if (m.col(n) < cols - 1) op.push(n + 1);
      if (m.fila(n) < rows - 1) op.push(n + cols);
      if (!op.length) continue;
      const k = clave(n, op[C.azar(op.length)]);
      if (m.bloqueadas.has(k) || m.cerradas.has(k)) continue;
      m.bloqueadas.add(k);
      if (!conectada()) m.bloqueadas.delete(k);
    }
    }
    const desde = (a) => { if (!m._bfs.has(a)) m._bfs.set(a, bfs(a)); return m._bfs.get(a); };
    m.dist = (a, b) => desde(a).dist[b];
    /** Camino más corto de a a b, incluyendo ambos extremos. */
    m.camino = (a, b) => {
      const { padre } = desde(a);
      const t = [];
      for (let n = b; n !== a; n = padre[n]) t.push(n);
      t.push(a);
      return t.reverse();
    };
    m.manhattan = (a, b) => Math.abs(m.col(a) - m.col(b)) + Math.abs(m.fila(a) - m.fila(b));
    /** ¿Se puede pasar entre a y b? (sin obra ni edificio) */
    m.abierta = (a, b) => !m.bloqueadas.has(clave(a, b)) && !m.cerradas.has(clave(a, b));
    /** Elige nodos al azar (nunca dentro de un edificio) separados entre sí y de "evitar". */
    m.elegirNodos = (cantidad, evitar = [], separacion = 2) => {
      const usados = [...evitar], out = [];
      let i = 0;
      while (out.length < cantidad && i++ < 4000) {
        const n = C.azar(cols * rows);
        if (m.interiores.has(n)) continue;
        const sep = i < 3000 ? separacion : 1;
        if (usados.every((u) => m.manhattan(u, n) >= sep)) { out.push(n); usados.push(n); }
      }
      return out;
    };
    /** Bases repartidas en los bordes, lejos entre sí. */
    m.elegirBases = (k) => {
      const mc = Math.floor(cols / 2), mr = Math.floor(rows / 2);
      const candidatas = C.barajar([
        m.id(0, mr), m.id(cols - 1, mr), m.id(mc, 0), m.id(mc, rows - 1),
        m.id(0, 0), m.id(cols - 1, rows - 1), m.id(cols - 1, 0), m.id(0, rows - 1),
      ]);
      const out = [];
      for (const n of candidatas) {
        if (out.length === k) break;
        if (out.every((b) => m.manhattan(b, n) >= Math.min(cols, rows) - 1)) out.push(n);
      }
      for (const n of candidatas) if (out.length < k && !out.includes(n)) out.push(n);
      return out;
    };
    return m;
  };

  /** Datos mínimos para rearmar la ciudad en otro equipo (ver crearCiudad({ datos })). */
  C.datosCiudad = (m) => ({
    cols: m.cols, rows: m.rows,
    bloqueadas: [...m.bloqueadas], cerradas: [...m.cerradas], interiores: [...m.interiores],
    edificios: m.edificios.map(({ k, r, w, h }) => ({ k, r, w, h })),
  });

  /**
   * Rutas abiertas óptimas (Held-Karp) desde una base sobre una lista de nodos.
   * costo[mask] = cuadras mínimas para visitar ese subconjunto (terminando donde convenga).
   * orden(mask) = índices en el orden óptimo.
   */
  C.rutasOptimas = function (mapa, base, nodos) {
    const n = nodos.length, N = 1 << n;
    const D = nodos.map((a) => nodos.map((b) => mapa.dist(a, b)));
    const dp = new Float64Array(N * n).fill(Infinity);
    const par = new Int8Array(N * n).fill(-1);
    for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = mapa.dist(base, nodos[j]);
    for (let mask = 1; mask < N; mask++) {
      for (let j = 0; j < n; j++) {
        if (!(mask & (1 << j))) continue;
        const v = dp[mask * n + j];
        if (v === Infinity) continue;
        for (let k = 0; k < n; k++) {
          if (mask & (1 << k)) continue;
          const nm = mask | (1 << k), c = v + D[j][k];
          if (c < dp[nm * n + k]) { dp[nm * n + k] = c; par[nm * n + k] = j; }
        }
      }
    }
    const costo = new Float64Array(N), ultimo = new Int8Array(N).fill(-1);
    for (let mask = 1; mask < N; mask++) {
      let best = Infinity;
      for (let j = 0; j < n; j++) if ((mask & (1 << j)) && dp[mask * n + j] < best) { best = dp[mask * n + j]; ultimo[mask] = j; }
      costo[mask] = best;
    }
    const orden = (mask) => {
      const seq = [];
      let j = ultimo[mask];
      while (mask && j >= 0) { seq.push(j); const pj = par[mask * n + j]; mask ^= 1 << j; j = pj; }
      return seq.reverse();
    };
    return { costo, orden };
  };

  /** Tramos (viaje + servicio) para una secuencia de nodos con tiempos fijos de servicio. */
  C.tramosDeRuta = function (mapa, base, nodosOrden, { minutosPorCuadra, servicios, inicio = 0 }) {
    const tramos = [];
    let t = inicio, nodo = base;
    nodosOrden.forEach((destino, i) => {
      const camino = mapa.camino(nodo, destino);
      const llegada = t + (camino.length - 1) * minutosPorCuadra;
      tramos.push({ tipo: "viaje", nodos: camino, t0: t, t1: llegada });
      const fin = llegada + servicios[i];
      tramos.push({ tipo: "servicio", nodo: destino, t0: llegada, t1: fin, indice: i });
      t = fin; nodo = destino;
    });
    return { tramos, fin: t };
  };

  // ---------- Dibujo ----------
  C.Vista = class {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.celda = 40; this.ox = 0; this.oy = 0; this.mapa = null;
      this.t = false;   // transpuesto: el mapa se dibuja acostado (se giró la pantalla)
    }
    ajustarLienzo() {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = innerWidth * dpr;
      this.canvas.height = innerHeight * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    /** Encaja la grilla dentro del rectángulo {x, y, w, h} (px de pantalla). */
    encuadrar(mapa, r, margen = 36) {
      this.mapa = mapa;
      // Si la pantalla se giró y quedó al revés del mapa, se dibuja acostado para que la llene.
      this.t = (mapa.rows > mapa.cols) !== (r.h > r.w) && mapa.rows !== mapa.cols;
      const cols = this.t ? mapa.rows : mapa.cols, rows = this.t ? mapa.cols : mapa.rows;
      const ancho = r.w - margen * 2, alto = r.h - margen * 2;
      this.celda = Math.max(10, Math.min(ancho / (cols - 1), alto / (rows - 1)));
      this.ox = r.x + (r.w - this.celda * (cols - 1)) / 2;
      this.oy = r.y + (r.h - this.celda * (rows - 1)) / 2;
    }
    /** Punto de la grilla (columna, fila; con decimales) en la pantalla, y al revés. */
    aPantalla(gx, gy) { const [a, b] = this.t ? [gy, gx] : [gx, gy]; return [this.ox + a * this.celda, this.oy + b * this.celda]; }
    aGrilla(x, y) { const a = (x - this.ox) / this.celda, b = (y - this.oy) / this.celda; return this.t ? [b, a] : [a, b]; }
    /** Ángulo de la grilla en la pantalla (acostado, el mapa queda reflejado en la diagonal). */
    angulo(a) { return this.t ? Math.PI / 2 - a : a; }
    /** Tamaño en pantalla de w columnas por h filas. */
    medida(w, h) { return this.t ? [h, w] : [w, h]; }
    px(n) { return this.aPantalla(this.mapa.col(n), this.mapa.fila(n)); }
    /** Nodo más cercano a un punto de pantalla y su distancia en px. */
    cercano(nodos, x, y) {
      let mejor = -1, d = Infinity;
      nodos.forEach((n, i) => { const [a, b] = this.px(n); const dd = Math.hypot(a - x, b - y); if (dd < d) { d = dd; mejor = i; } });
      return { indice: mejor, distancia: d };
    }
    limpiar() {
      this.ctx.fillStyle = C.COLOR.calle;
      this.ctx.fillRect(0, 0, innerWidth, innerHeight);
    }
    ciudad() {
      const { ctx, mapa, celda: c } = this, calle = Math.max(8, c * 0.26);
      const enEdificio = new Set((mapa.edificios || []).flatMap((e) => e.manzanas));
      for (let r = 0; r < mapa.rows - 1; r++) for (let k = 0; k < mapa.cols - 1; k++) {
        if (enEdificio.has(mapa.id(k, r))) continue;
        const [x, y] = this.px(mapa.id(k, r));
        this.redondeado(x + calle / 2, y + calle / 2, c - calle, c - calle, Math.min(10, c * 0.15));
        ctx.fillStyle = C.COLOR.manzana; ctx.fill();
        ctx.strokeStyle = C.COLOR.manzanaBorde; ctx.lineWidth = 1; ctx.stroke();
      }
      for (const e of mapa.edificios || []) this.edificio(e, calle);
      for (const k of mapa.bloqueadas) {
        const [a, b] = k.split("-").map(Number);
        const [x1, y1] = this.px(a), [x2, y2] = this.px(b);
        ctx.save();
        ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
        if (x1 === x2) ctx.rotate(Math.PI / 2);
        const w = Math.max(5, c * 0.1), h = calle * 1.1;
        ctx.fillStyle = C.COLOR.obra; this.redondeado(-w / 2, -h / 2, w, h, 3); ctx.fill();
        ctx.fillStyle = C.COLOR.blanco;
        for (const s of [-1, 1]) ctx.fillRect(-w / 2, s * h / 4 - 1.5, w, 3);
        ctx.restore();
      }
    }
    /** Edificio: varias manzanas unidas, con un techo marcado para que se distinga. */
    edificio(e, calle, radio) {
      const { ctx, celda: c } = this, [x, y] = this.px(this.mapa.id(e.k, e.r));
      const [ew, eh] = this.medida(e.w, e.h);
      const w = ew * c - calle, h = eh * c - calle, rr = radio ?? Math.min(12, c * 0.16);
      this.redondeado(x + calle / 2, y + calle / 2, w, h, rr);
      ctx.fillStyle = C.COLOR.edificio; ctx.fill();
      ctx.strokeStyle = C.COLOR.edificioBorde; ctx.lineWidth = 1.5; ctx.stroke();
      const m = Math.min(w, h) * 0.16;
      this.redondeado(x + calle / 2 + m, y + calle / 2 + m, w - 2 * m, h - 2 * m, Math.max(3, rr - 4));
      ctx.strokeStyle = "rgba(255,255,255,.65)"; ctx.lineWidth = 2; ctx.stroke();
    }
    base(n, color = C.COLOR.base, texto = "BASE") {
      const { ctx } = this, [x, y] = this.px(n), tb = Math.max(26, this.celda * 0.44);
      ctx.fillStyle = color; this.redondeado(x - tb / 2, y - tb / 2, tb, tb, 7); ctx.fill();
      ctx.fillStyle = C.COLOR.blanco;
      ctx.font = `700 ${tb * (texto.length > 3 ? 0.27 : 0.36)}px "IBM Plex Sans", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(texto, x, y + 1);
    }
    /** Círculo de orden/cliente. */
    pin(n, { relleno = C.COLOR.blanco, borde = C.COLOR.acento, texto = "", tinta, radio, discontinuo = false }) {
      const { ctx } = this, [x, y] = this.px(n), r = radio ?? Math.max(13, this.celda * 0.2);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = relleno; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = borde;
      if (discontinuo) ctx.setLineDash([4, 4]);
      ctx.stroke(); ctx.setLineDash([]);
      if (texto) {
        ctx.fillStyle = tinta ?? (relleno === C.COLOR.blanco ? borde : C.COLOR.blanco);
        ctx.font = `700 ${r * 0.95}px "IBM Plex Sans", sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(texto, x, y + 1);
      }
      return r;
    }
    etiqueta(n, texto, fondo, tinta = C.COLOR.blanco, dy) {
      const { ctx } = this, [x, y] = this.px(n);
      const fs = Math.max(10, Math.min(16, this.celda * 0.16));
      ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`;
      const w = ctx.measureText(texto).width + fs * 0.9, h = fs * 1.5;
      const ey = y + (dy ?? -(Math.max(13, this.celda * 0.2) + h / 2 + 5));
      this.redondeado(x - w / 2, ey - h / 2, w, h, h / 2); ctx.fillStyle = fondo; ctx.fill();
      ctx.fillStyle = tinta; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(texto, x, ey + 1);
    }
    /** Dibuja los viajes de una lista de tramos hasta el minuto "hasta". */
    trazar(tramos, hasta, color, grosor, alfa) {
      const { ctx } = this;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.globalAlpha = alfa;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const tr of tramos) {
        if (tr.tipo !== "viaje" || tr.t0 > hasta || tr.nodos.length < 2) continue;
        const pasos = tr.nodos.length - 1;
        const s = hasta >= tr.t1 ? pasos : pasos * (hasta - tr.t0) / Math.max(tr.t1 - tr.t0, 1e-6);
        ctx.beginPath();
        for (let k = 0; k <= Math.floor(s); k++) { const [x, y] = this.px(tr.nodos[k]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        if (s < pasos) {
          const i = Math.floor(s), f = s - i;
          const [x1, y1] = this.px(tr.nodos[i]), [x2, y2] = this.px(tr.nodos[i + 1]);
          ctx.lineTo(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    /** Posición del vehículo a la hora t según sus tramos. */
    posicion(tramos, t, nodoInicial) {
      let nodo = nodoInicial, ang = 0;
      for (const tr of tramos) {
        if (t < tr.t0) break;
        if (tr.tipo === "viaje" && tr.nodos.length > 1) {
          const pasos = tr.nodos.length - 1;
          if (t <= tr.t1) {
            const s = pasos * (t - tr.t0) / Math.max(tr.t1 - tr.t0, 1e-6);
            const i = Math.min(Math.floor(s), pasos - 1), f = s - i;
            const [x1, y1] = this.px(tr.nodos[i]), [x2, y2] = this.px(tr.nodos[i + 1]);
            return { x: x1 + (x2 - x1) * f, y: y1 + (y2 - y1) * f, ang: Math.atan2(y2 - y1, x2 - x1) };
          }
          const [ax, ay] = this.px(tr.nodos[pasos - 1]), [bx, by] = this.px(tr.nodos[pasos]);
          ang = Math.atan2(by - ay, bx - ax);
          nodo = tr.nodos[pasos];
        } else if (tr.nodo != null) nodo = tr.nodo;
      }
      const [x, y] = this.px(nodo);
      return { x, y, ang };
    }
    furgon({ x, y, ang }, color, apagado = false) {
      const { ctx } = this, largo = Math.max(24, this.celda * 0.36), ancho = largo * 0.6;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang);
      if (apagado) ctx.globalAlpha = 0.45;
      ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillStyle = color;
      this.redondeado(-largo / 2, -ancho / 2, largo, ancho, ancho * 0.25); ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(255,255,255,.9)";
      this.redondeado(largo * 0.18, -ancho * 0.36, largo * 0.18, ancho * 0.72, 3); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect(-largo * 0.4, -ancho * 0.3, largo * 0.48, ancho * 0.6);
      ctx.restore();
    }
    redondeado(x, y, w, h, r) {
      const { ctx } = this;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  };

  // ---------- Barras de jornada (HTML) ----------
  /**
   * items: [{ nombre, color, hasta (min), exceso (min, opcional), texto, ahora (min, opcional), apagado }]
   * limite: fin de jornada (min). marca: línea de referencia (min, opcional).
   */
  C.pintarBarras = function (el, items, { limite, marca }) {
    el.innerHTML = items.map((it) => {
      const pct = (m) => Math.max(0, Math.min(100, (m / limite) * 100));
      const excede = (it.exceso ?? 0) > 0;
      return `<div class="barra-fila${it.apagado ? " apagada" : ""}">
        <span class="barra-nombre"><span class="punto" style="background:${it.color}"></span>${C.escapar(it.nombre)}</span>
        <span class="barra">
          <span class="barra-relleno${excede ? " excede" : ""}" style="width:${pct(it.hasta)}%;background:${excede ? "" : it.color}"></span>
          ${marca != null ? `<span class="barra-marca" style="left:${pct(marca)}%"></span>` : ""}
          ${it.ahora != null ? `<span class="barra-ahora" style="left:${pct(it.ahora)}%"></span>` : ""}
        </span>
        <span class="barra-texto${excede ? " excede" : ""}">${C.escapar(it.texto ?? "")}</span>
      </div>`;
    }).join("");
  };

  // ---------- Ranking ----------
  C.Ranking = class {
    constructor(clave, max = 10) { this.clave = clave; this.max = max; }
    leer() { try { return JSON.parse(localStorage.getItem(this.clave)) || []; } catch { return []; } }
    guardar(l) { try { localStorage.setItem(this.clave, JSON.stringify(l)); } catch { /* sin almacenamiento */ } }
    agregar(nombre, puntos) {
      const r = { nombre: nombre.trim().slice(0, 14) || "Anónimo", puntos, t: Date.now() };
      this.guardar([...this.leer(), r].sort((a, b) => b.puntos - a.puntos || a.t - b.t).slice(0, this.max));
      return r;
    }
    borrar() { this.guardar([]); }
    /** Tabla de ranking (mismo diseño en todos los juegos): top 5 en el inicio, top 10 al final. */
    pintar(el, resaltado) {
      const l = this.leer().slice(0, el.id === "ranking-inicio" ? 5 : 10);
      if (!l.length) { el.innerHTML = ""; return; }
      el.innerHTML = "<h3>Ranking</h3><ol>" + l.map((r, i) =>
        `<li class="${resaltado && r.t === resaltado.t ? "tuyo" : ""}"><span class="pos">${i + 1}</span>` +
        `<span class="nombre">${C.escapar(r.nombre || "Anónimo")}</span><span class="pts">${Math.round(r.puntos).toLocaleString("es-CL")}</span></li>`).join("") + "</ol>";
    }
  };

  // ---------- Modo stand ----------
  /**
   * Pantalla completa (#btn-pantalla), vuelta al inicio por inactividad y
   * borrado oculto del ranking (mantener presionado #logo 3 s).
   */
  C.modoStand = function ({ inactividadMs, enJuego, alInactivo, ranking, alBorrar }) {
    let ultimo = Date.now();
    for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { ultimo = Date.now(); }, true);
    setInterval(() => { if (enJuego() && Date.now() - ultimo > inactividadMs) { ultimo = Date.now(); alInactivo(); } }, 1000);
    document.getElementById("btn-pantalla")?.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    const logo = document.getElementById("logo");
    let tmp = null;
    logo?.addEventListener("pointerdown", () => {
      tmp = setTimeout(() => { if (confirm("¿Borrar el ranking del stand?")) { ranking.borrar(); alBorrar?.(); } }, 3000);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) logo?.addEventListener(ev, () => clearTimeout(tmp));
  };

  window.Comun = C;
})();
