/* Gánale al Chip — minijuego del stand de Control Position.
 *
 * La ciudad es una grilla de calles. El jugador toca los clientes en el
 * orden en que quiere visitarlos; su auto va siempre por el camino más
 * corto entre uno y otro, así que lo único que decide es el ORDEN, que es
 * justo lo que resuelve el optimizador. El chip calcula el orden óptimo
 * (ruta abierta: termina en el último cliente) y sale con unos segundos de
 * desventaja. Gana quien visite a todos primero.
 *
 * Todo lo que conviene ajustar después de probar en el stand está en AJUSTES.
 */
(() => {
  "use strict";

  const AJUSTES = {
    velocidad: 5,            // cuadras por segundo (igual para los dos autos)
    inactividadMs: 40000,    // sin toques por este tiempo → vuelve al inicio
    rankingMax: 10,
    claveRanking: "ganale-al-chip.ranking",
    niveles: [
      // ventaja = segundos que espera el chip antes de salir
      { clientes: 4, obras: 7,  ventaja: 1.0 },   // de calentamiento: casi siempre se gana
      { clientes: 6, obras: 15, ventaja: 0.6 },
      { clientes: 8, obras: 22, ventaja: 0.3 },   // aquí el chip suele ganar
    ],
    puntosEficiencia: 600,   // × (ruta del chip / tu ruta)
    puntosVictoria: 400,
  };

  const COLOR = {
    calle: "#FBF6F6", manzana: "#ece4e4", manzanaBorde: "#e2d8d8",
    tu: "#033E84", chip: "#e07419", ok: "#27945c", obra: "#d9930c",
    texto: "#1c1a1b", blanco: "#ffffff", base: "#1c1a1b",
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("mapa");
  const ctx = canvas.getContext("2d");
  const ui = {
    hud: $("hud"), hudNivel: $("hud-nivel"), hudAyuda: $("hud-ayuda"),
    tTu: $("t-tu"), tChip: $("t-chip"),
    inicio: $("inicio"), cuenta: $("cuenta"), cuentaNum: $("cuenta-num"),
    resultado: $("resultado"), resTitulo: $("res-titulo"), resTu: $("res-tu"), resChip: $("res-chip"),
    resDetalle: $("res-detalle"), resPuntos: $("res-puntos"), btnSiguiente: $("btn-siguiente"),
    final: $("final"), finPuntos: $("fin-puntos"), finMensaje: $("fin-mensaje"),
    form: $("form-nombre"), nombre: $("nombre"),
    rankingInicio: $("ranking-inicio"), rankingFinal: $("ranking-final"),
  };

  // ---------- Estado ----------
  let fase = "inicio";          // inicio | cuenta | carrera | resultado | final
  let nivelIdx = 0;
  let puntosTotal = 0;
  let victorias = 0;
  let mapa = null;              // { cols, rows, bloqueadas:Set, base, clientes:[] }
  let jugador = null;           // { ruta:[nodos], s, elegidos:[], llegadas:{}, fin }
  let chip = null;              // { ruta, s, orden, distancia, fin }
  let tCarrera = 0;             // segundos desde el "¡Ya!"
  let ultimoToque = Date.now();
  let geo = { celda: 40, ox: 0, oy: 0 };

  // ---------- Utilidades de grilla ----------
  const id = (c, r) => r * mapa.cols + c;
  const col = (n) => n % mapa.cols;
  const fila = (n) => Math.floor(n / mapa.cols);
  const claveArista = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
  const azar = (n) => Math.floor(Math.random() * n);

  function vecinos(n, bloqueadas) {
    const c = col(n), r = fila(n), out = [];
    if (c > 0) out.push(n - 1);
    if (c < mapa.cols - 1) out.push(n + 1);
    if (r > 0) out.push(n - mapa.cols);
    if (r < mapa.rows - 1) out.push(n + mapa.cols);
    return out.filter((v) => !bloqueadas.has(claveArista(n, v)));
  }

  // BFS desde un nodo: distancias y padres para reconstruir caminos.
  function bfs(origen, bloqueadas) {
    const total = mapa.cols * mapa.rows;
    const dist = new Array(total).fill(Infinity);
    const padre = new Array(total).fill(-1);
    dist[origen] = 0;
    const cola = [origen];
    for (let i = 0; i < cola.length; i++) {
      const n = cola[i];
      for (const v of vecinos(n, bloqueadas)) {
        if (dist[v] === Infinity) { dist[v] = dist[n] + 1; padre[v] = n; cola.push(v); }
      }
    }
    return { dist, padre };
  }

  function camino(desde, hasta) {
    const { padre } = mapa.arboles.get(desde);
    const tramo = [];
    for (let n = hasta; n !== desde; n = padre[n]) tramo.push(n);
    return tramo.reverse();      // sin incluir "desde"
  }

  // ---------- Generación del mapa ----------
  // ---------- Edificios: manzanas vecinas unidas (2×1, 1×2, 2×2, 3×1) ----------
  // La calle entre ellas desaparece (mapa.cortes) y los cruces que quedan
  // adentro no se usan (mapa.interiores). mapa.cortes también incluye las obras.
  const FORMAS_EDIFICIO = [[2, 1], [1, 2], [2, 1], [1, 2], [2, 2], [2, 2], [3, 1], [1, 3]];
  const conectada = () => bfs(0, mapa.cortes).dist.every((d, n) => d < Infinity || mapa.interiores.has(n));
  function ponerEdificios(cantidad) {
    const { cols, rows } = mapa, ocupadas = new Set();
    let intentos = 0;
    while (mapa.edificios.length < cantidad && intentos++ < 400) {
      const [w, h] = FORMAS_EDIFICIO[azar(FORMAS_EDIFICIO.length)];
      if (w > cols - 1 || h > rows - 1) continue;
      const k = azar(cols - w), r = azar(rows - h);
      const manzanas = [], aristas = [], internos = [];
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
        manzanas.push(id(k + i, r + j));
        if (i < w - 1) aristas.push(claveArista(id(k + i + 1, r + j), id(k + i + 1, r + j + 1)));
        if (j < h - 1) aristas.push(claveArista(id(k + i, r + j + 1), id(k + i + 1, r + j + 1)));
        if (i > 0 && j > 0) internos.push(id(k + i, r + j));
      }
      if (manzanas.some((n) => ocupadas.has(n))) continue;
      aristas.forEach((a) => mapa.cortes.add(a)); internos.forEach((n) => mapa.interiores.add(n));
      if (!conectada()) { aristas.forEach((a) => mapa.cortes.delete(a)); internos.forEach((n) => mapa.interiores.delete(n)); continue; }
      manzanas.forEach((n) => ocupadas.add(n));
      mapa.edificios.push({ k, r, w, h, manzanas });
    }
  }

  function generarMapa(nivel) {
    const vertical = innerHeight > innerWidth * 1.1;
    const cols = vertical ? 7 : 11;
    const rows = vertical ? 10 : 7;
    mapa = { cols, rows, bloqueadas: new Set(), cortes: new Set(), interiores: new Set(), edificios: [], base: 0, clientes: [], arboles: new Map() };
    ponerEdificios(Math.round(((cols - 1) * (rows - 1)) / 9));

    // Obras: se cortan calles al azar sin dejar partes de la ciudad aisladas.
    let intentos = 0;
    while (mapa.bloqueadas.size < nivel.obras && intentos++ < 400) {
      const n = azar(cols * rows);
      const opciones = [];
      if (col(n) < cols - 1) opciones.push(n + 1);
      if (fila(n) < rows - 1) opciones.push(n + cols);
      if (!opciones.length) continue;
      const k = claveArista(n, opciones[azar(opciones.length)]);
      if (mapa.bloqueadas.has(k) || mapa.cortes.has(k)) continue;
      mapa.bloqueadas.add(k); mapa.cortes.add(k);
      if (!conectada()) { mapa.bloqueadas.delete(k); mapa.cortes.delete(k); }
    }

    // Base y clientes separados entre sí (al menos 2 cuadras).
    const manhattan = (a, b) => Math.abs(col(a) - col(b)) + Math.abs(fila(a) - fila(b));
    const lado = azar(4);
    mapa.base = lado === 0 ? id(0, azar(rows)) : lado === 1 ? id(cols - 1, azar(rows))
              : lado === 2 ? id(azar(cols), 0) : id(azar(cols), rows - 1);
    const usados = [mapa.base];
    intentos = 0;
    while (mapa.clientes.length < nivel.clientes && intentos++ < 2000) {
      const n = azar(cols * rows);
      const minimo = intentos < 1500 ? 2 : 1;
      if (!mapa.interiores.has(n) && usados.every((u) => manhattan(u, n) >= minimo)) { mapa.clientes.push(n); usados.push(n); }
    }

    for (const n of usados) mapa.arboles.set(n, bfs(n, mapa.cortes));
  }

  // Orden óptimo (ruta abierta desde la base) por fuerza bruta con poda:
  // con 8 clientes son a lo más 40.320 órdenes, toma milisegundos.
  function rutaOptima() {
    const cl = mapa.clientes;
    const d = (a, b) => mapa.arboles.get(a).dist[b];
    let mejor = Infinity, mejorOrden = null;
    const usado = new Array(cl.length).fill(false);
    const orden = [];
    (function probar(actual, acumulado) {
      if (acumulado >= mejor) return;
      if (orden.length === cl.length) { mejor = acumulado; mejorOrden = orden.slice(); return; }
      for (let i = 0; i < cl.length; i++) {
        if (usado[i]) continue;
        usado[i] = true; orden.push(cl[i]);
        probar(cl[i], acumulado + d(actual, cl[i]));
        orden.pop(); usado[i] = false;
      }
    })(mapa.base, 0);
    const ruta = [mapa.base];
    let actual = mapa.base;
    for (const n of mejorOrden) { ruta.push(...camino(actual, n)); actual = n; }
    return { orden: mejorOrden, ruta, distancia: mejor };
  }

  // ---------- Geometría / dibujo ----------
  function ajustarCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!mapa) return;
    const arriba = ui.hud.hidden ? 16 : ui.hud.offsetHeight + 16;
    const margen = 34;
    const ancho = innerWidth - margen * 2;
    const alto = innerHeight - arriba - margen * 2;
    geo.celda = Math.min(ancho / (mapa.cols - 1), alto / (mapa.rows - 1));
    geo.ox = (innerWidth - geo.celda * (mapa.cols - 1)) / 2;
    geo.oy = arriba + margen + (alto - geo.celda * (mapa.rows - 1)) / 2;
  }

  const px = (n) => [geo.ox + col(n) * geo.celda, geo.oy + fila(n) * geo.celda];

  function posicionEnRuta(ruta, s, desfase) {
    const i = Math.min(Math.floor(s), ruta.length - 1);
    const j = Math.min(i + 1, ruta.length - 1);
    const f = Math.min(s - i, 1);
    const [x1, y1] = px(ruta[i]), [x2, y2] = px(ruta[j]);
    let ang = Math.atan2(y2 - y1, x2 - x1);
    if (i === j && i > 0) { const [x0, y0] = px(ruta[i - 1]); ang = Math.atan2(y1 - y0, x1 - x0); }
    const ox = -Math.sin(ang) * desfase, oy = Math.cos(ang) * desfase;
    return { x: x1 + (x2 - x1) * f + ox, y: y1 + (y2 - y1) * f + oy, ang };
  }

  function dibujar() {
    ctx.fillStyle = COLOR.calle;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    if (!mapa) return;
    const c = geo.celda, calle = Math.max(10, c * 0.26);

    // Manzanas sueltas
    const enEdificio = new Set(mapa.edificios.flatMap((e) => e.manzanas));
    for (let r = 0; r < mapa.rows - 1; r++) {
      for (let k = 0; k < mapa.cols - 1; k++) {
        if (enEdificio.has(id(k, r))) continue;
        const [x, y] = px(id(k, r));
        redondeado(x + calle / 2, y + calle / 2, c - calle, c - calle, Math.min(10, c * 0.15));
        ctx.fillStyle = COLOR.manzana; ctx.fill();
        ctx.strokeStyle = COLOR.manzanaBorde; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    // Edificios (varias manzanas unidas), con un techo marcado
    for (const e of mapa.edificios) {
      const [x, y] = px(id(e.k, e.r)), w = e.w * c - calle, h = e.h * c - calle, rr = Math.min(12, c * 0.16);
      redondeado(x + calle / 2, y + calle / 2, w, h, rr);
      ctx.fillStyle = "#e3d7d7"; ctx.fill();
      ctx.strokeStyle = "#d3c5c5"; ctx.lineWidth = 1.5; ctx.stroke();
      const m = Math.min(w, h) * 0.16;
      redondeado(x + calle / 2 + m, y + calle / 2 + m, w - 2 * m, h - 2 * m, Math.max(3, rr - 4));
      ctx.strokeStyle = "rgba(255,255,255,.65)"; ctx.lineWidth = 2; ctx.stroke();
    }

    // Obras (calles cortadas)
    for (const k of mapa.bloqueadas) {
      const [a, b] = k.split("-").map(Number);
      const [x1, y1] = px(a), [x2, y2] = px(b);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const horizontal = y1 === y2;
      ctx.save();
      ctx.translate(mx, my);
      if (!horizontal) ctx.rotate(Math.PI / 2);
      const w = c * 0.12, h = calle * 1.1;
      ctx.fillStyle = COLOR.obra;
      redondeado(-w / 2, -h / 2, w, h, 3); ctx.fill();
      ctx.fillStyle = COLOR.blanco;
      for (let i = -1; i <= 1; i += 2) ctx.fillRect(-w / 2, i * h / 4 - 1.5, w, 3);
      ctx.restore();
    }

    // Rutas
    // La del chip va ancha y suave por debajo; la tuya, fina encima: así se
    // ve dónde coinciden y dónde se separan.
    if (chip && chip.s > 0) trazar(chip.ruta, chip.s, COLOR.chip, Math.max(9, c * 0.15), 0.4);
    if (jugador) trazar(jugador.ruta, jugador.ruta.length - 1, COLOR.tu, Math.max(4, c * 0.06), 0.9);

    // Base
    const [bx, by] = px(mapa.base);
    const tb = Math.max(30, c * 0.46);
    ctx.fillStyle = COLOR.base;
    redondeado(bx - tb / 2, by - tb / 2, tb, tb, 7); ctx.fill();
    ctx.fillStyle = COLOR.blanco;
    ctx.font = `700 ${tb * 0.27}px "IBM Plex Sans", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("BASE", bx, by + 1);

    // Clientes
    const rc = Math.max(15, c * 0.24);
    mapa.clientes.forEach((n) => {
      const [x, y] = px(n);
      const pos = jugador ? jugador.elegidos.indexOf(n) : -1;
      const atendido = jugador && jugador.llegadas[n] != null;
      ctx.beginPath(); ctx.arc(x, y, rc, 0, Math.PI * 2);
      ctx.fillStyle = atendido ? COLOR.ok : pos >= 0 ? COLOR.tu : COLOR.blanco;
      ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = atendido ? COLOR.ok : COLOR.tu; ctx.stroke();
      ctx.fillStyle = pos >= 0 ? COLOR.blanco : COLOR.tu;
      ctx.font = `700 ${rc * 0.95}px "IBM Plex Sans", sans-serif`;
      ctx.fillText(pos >= 0 ? String(pos + 1) : "?", x, y + 1);
      // número del chip en la revisión final
      if (fase === "resultado" && chip) {
        const k = chip.orden.indexOf(n) + 1;
        const ex = x + rc * 0.85, ey = y - rc * 0.85, er = rc * 0.5;
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fillStyle = COLOR.chip; ctx.fill();
        ctx.fillStyle = COLOR.blanco;
        ctx.font = `700 ${er * 1.1}px "IBM Plex Sans", sans-serif`;
        ctx.fillText(String(k), ex, ey + 1);
      }
    });

    // Autos
    const largo = Math.max(24, c * 0.36);
    if (chip) {
      const p = posicionEnRuta(chip.ruta, Math.max(0, chip.s), 3.5);
      auto(p, largo, COLOR.chip, true);
    }
    if (jugador) {
      const p = posicionEnRuta(jugador.ruta, jugador.s, -3.5);
      auto(p, largo, COLOR.tu, false);
    }

    // Chip "pensando" antes de salir
    if (fase === "carrera" && tCarrera < nivelActual().ventaja) {
      const f = tCarrera / nivelActual().ventaja;
      ctx.beginPath();
      ctx.arc(bx, by, tb * 0.95, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      ctx.strokeStyle = COLOR.chip; ctx.lineWidth = 4; ctx.stroke();
    }
  }

  function trazar(ruta, hasta, color, grosor, alfa) {
    if (ruta.length < 2 || hasta <= 0) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.globalAlpha = alfa;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    for (let k = 0; k <= Math.floor(hasta); k++) {
      const [x, y] = px(ruta[k]);
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const fin = posicionEnRuta(ruta, hasta, 0);
    ctx.lineTo(fin.x, fin.y);
    ctx.stroke();
    ctx.restore();
  }

  function auto({ x, y, ang }, largo, color, esChip) {
    const ancho = largo * 0.58;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = color;
    redondeado(-largo / 2, -ancho / 2, largo, ancho, ancho * 0.35); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,255,255,.85)";
    redondeado(largo * 0.08, -ancho * 0.32, largo * 0.22, ancho * 0.64, 3); ctx.fill();
    if (esChip) {
      // pequeño chip con patitas en el techo
      const t = ancho * 0.42;
      ctx.fillStyle = COLOR.blanco;
      ctx.fillRect(-largo * 0.3, -t / 2, t, t);
      ctx.fillStyle = color;
      ctx.fillRect(-largo * 0.3 + t * 0.25, -t / 4, t / 2, t / 2);
    }
    ctx.restore();
  }

  function redondeado(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Flujo del juego ----------
  const nivelActual = () => AJUSTES.niveles[nivelIdx];

  function mostrar(capa) {
    for (const c of [ui.inicio, ui.cuenta, ui.resultado, ui.final]) c.hidden = c !== capa;
  }

  function irAlInicio() {
    fase = "inicio";
    mapa = null; jugador = null; chip = null;
    ui.hud.hidden = true;
    pintarRanking(ui.rankingInicio, null);
    mostrar(ui.inicio);
    ajustarCanvas();
  }

  function nuevaPartida() {
    nivelIdx = 0; puntosTotal = 0; victorias = 0;
    empezarNivel();
  }

  function empezarNivel() {
    const nivel = nivelActual();
    generarMapa(nivel);
    const optima = rutaOptima();
    chip = { ...optima, s: -1, fin: null };
    jugador = { ruta: [mapa.base], s: 0, elegidos: [], llegadas: {}, fin: null };
    tCarrera = 0;
    ui.hud.hidden = false;
    ui.hudNivel.textContent = `Nivel ${nivelIdx + 1} de ${AJUSTES.niveles.length}`;
    ui.hudAyuda.textContent = `Toca los ${nivel.clientes} clientes en el orden que prefieras`;
    ui.tTu.textContent = ui.tChip.textContent = "0.0 s";
    ajustarCanvas();
    fase = "cuenta";
    mostrar(ui.cuenta);
    let n = 3;
    const paso = () => {
      if (fase !== "cuenta") return;
      ui.cuentaNum.textContent = n > 0 ? String(n) : "¡Ya!";
      ui.cuentaNum.style.animation = "none"; void ui.cuentaNum.offsetWidth; ui.cuentaNum.style.animation = "";
      if (n-- > 0) setTimeout(paso, 800);
      else setTimeout(() => { if (fase === "cuenta") { fase = "carrera"; mostrar(null); } }, 450);
    };
    paso();
  }

  function elegirCliente(n) {
    if (jugador.elegidos.includes(n)) return;
    const desde = jugador.elegidos.length ? jugador.elegidos[jugador.elegidos.length - 1] : mapa.base;
    jugador.ruta.push(...camino(desde, n));
    jugador.elegidos.push(n);
    jugador.llegadas[n] = undefined;
    const faltan = mapa.clientes.length - jugador.elegidos.length;
    ui.hudAyuda.textContent = faltan ? `Faltan ${faltan}` : "¡Ruta lista!";
  }

  function avanzar(dt) {
    if (fase !== "carrera") return;
    tCarrera += dt;
    const v = AJUSTES.velocidad;

    // Jugador: avanza mientras tenga camino por delante.
    const finRuta = jugador.ruta.length - 1;
    jugador.s = Math.min(jugador.s + v * dt, finRuta);
    let idx = 0;
    for (const n of jugador.elegidos) {
      idx = jugador.ruta.indexOf(n, idx);
      if (jugador.llegadas[n] == null && jugador.s >= idx) jugador.llegadas[n] = tCarrera;
    }
    if (jugador.fin == null && jugador.elegidos.length === mapa.clientes.length && jugador.s >= finRuta) {
      jugador.fin = tCarrera;
    }

    // Chip: sale cuando se acaba su ventaja.
    const ventaja = nivelActual().ventaja;
    if (tCarrera >= ventaja) {
      chip.s = Math.min((tCarrera - ventaja) * v, chip.ruta.length - 1);
      if (chip.fin == null && chip.s >= chip.ruta.length - 1) chip.fin = tCarrera;
    }

    ui.tTu.textContent = (jugador.fin ?? tCarrera).toFixed(1) + " s";
    ui.tChip.textContent = (chip.fin ?? tCarrera).toFixed(1) + " s";

    if (jugador.fin != null && chip.fin != null) terminarNivel();
  }

  function terminarNivel() {
    fase = "resultado";
    const tuDist = jugador.ruta.length - 1;
    const gano = jugador.fin < chip.fin;
    const eficiencia = chip.distancia / tuDist;
    const puntos = Math.round(AJUSTES.puntosEficiencia * eficiencia) + (gano ? AJUSTES.puntosVictoria : 0);
    puntosTotal += puntos;
    if (gano) victorias++;

    ui.resTitulo.textContent = gano ? "¡Le ganaste al chip!" : "Ganó el chip";
    ui.resTu.textContent = `${tuDist} cuadras · ${jugador.fin.toFixed(1)} s`;
    ui.resChip.textContent = `${chip.distancia} cuadras · ${chip.fin.toFixed(1)} s`;
    const extra = Math.round((tuDist / chip.distancia - 1) * 100);
    ui.resDetalle.textContent =
      extra === 0 && gano ? "Ruta perfecta: igual de corta que la del optimizador." :
      extra === 0 ? "Ruta perfecta… pero el chip la planificó más rápido que tú." :
      `Tu ruta fue ${extra}% más larga. Los números naranjos muestran el orden del chip.`;
    ui.resPuntos.textContent = puntos;
    ui.btnSiguiente.textContent = nivelIdx < AJUSTES.niveles.length - 1 ? "Siguiente nivel" : "Ver puntaje";
    mostrar(ui.resultado);
  }

  function siguiente() {
    if (nivelIdx < AJUSTES.niveles.length - 1) { nivelIdx++; empezarNivel(); }
    else terminarPartida();
  }

  let registroActual = null;
  function terminarPartida() {
    fase = "final";
    ui.hud.hidden = true;
    ui.finPuntos.textContent = puntosTotal;
    const total = AJUSTES.niveles.length;
    ui.finMensaje.textContent =
      victorias === total ? "Le ganaste al chip en todos los niveles. ¡Eres un despachador de élite!" :
      victorias > 0 ? `Le ganaste al chip en ${victorias} de ${total} niveles.` :
      "El chip ganó todas. Planificar rutas a mano es difícil… por eso existe el optimizador.";
    registroActual = null;
    ui.form.hidden = false;
    ui.nombre.value = "";
    pintarRanking(ui.rankingFinal, null);
    mostrar(ui.final);
  }

  // ---------- Ranking (se guarda en este navegador) ----------
  function leerRanking() {
    try { return JSON.parse(localStorage.getItem(AJUSTES.claveRanking)) || []; } catch { return []; }
  }
  function guardarRanking(lista) {
    try { localStorage.setItem(AJUSTES.claveRanking, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  }
  function pintarRanking(el, resaltado) {
    const lista = leerRanking();
    if (!lista.length) { el.innerHTML = ""; return; }
    const filas = lista.map((r, i) =>
      `<li class="${r === resaltado || (resaltado && r.t === resaltado.t) ? "tuyo" : ""}">` +
      `<span class="pos">${i + 1}</span><span>${escapar(r.nombre)}</span><span class="pts">${r.puntos}</span></li>`
    ).join("");
    el.innerHTML = `<h3>Mejores puntajes</h3><ol>${filas}</ol>`;
  }
  const escapar = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  ui.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (registroActual) return;
    const nombre = ui.nombre.value.trim().slice(0, 14) || "Anónimo";
    registroActual = { nombre, puntos: puntosTotal, t: Date.now() };
    const lista = [...leerRanking(), registroActual]
      .sort((a, b) => b.puntos - a.puntos || a.t - b.t)
      .slice(0, AJUSTES.rankingMax);
    guardarRanking(lista);
    ui.form.hidden = true;
    ui.nombre.blur();
    pintarRanking(ui.rankingFinal, registroActual);
  });

  // ---------- Entrada ----------
  canvas.addEventListener("pointerdown", (e) => {
    ultimoToque = Date.now();
    if (fase !== "carrera" || !mapa) return;
    let mejor = null, mejorD = Infinity;
    for (const n of mapa.clientes) {
      if (jugador.elegidos.includes(n)) continue;
      const [x, y] = px(n);
      const d = Math.hypot(e.clientX - x, e.clientY - y);
      if (d < mejorD) { mejorD = d; mejor = n; }
    }
    if (mejor != null && mejorD < geo.celda * 0.6) elegirCliente(mejor);
  });
  document.addEventListener("pointerdown", () => { ultimoToque = Date.now(); }, true);
  document.addEventListener("keydown", () => { ultimoToque = Date.now(); }, true);

  $("btn-jugar").addEventListener("click", nuevaPartida);
  $("btn-otra").addEventListener("click", nuevaPartida);
  ui.btnSiguiente.addEventListener("click", siguiente);

  $("btn-pantalla").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });

  // Mantener presionado el logo 3 s borra el ranking (para el inicio del evento).
  let temporizadorBorrar = null;
  $("logo").addEventListener("pointerdown", () => {
    temporizadorBorrar = setTimeout(() => {
      if (confirm("¿Borrar el ranking del stand?")) { guardarRanking([]); pintarRanking(ui.rankingInicio, null); }
    }, 3000);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
    $("logo").addEventListener(ev, () => clearTimeout(temporizadorBorrar));
  }

  addEventListener("resize", ajustarCanvas);

  // ---------- Bucle ----------
  let anterior = performance.now();
  function cuadro(ahora) {
    const dt = Math.min((ahora - anterior) / 1000, 0.05);
    anterior = ahora;
    avanzar(dt);
    dibujar();
    if (fase !== "inicio" && Date.now() - ultimoToque > AJUSTES.inactividadMs) irAlInicio();
    requestAnimationFrame(cuadro);
  }

  // Solo lectura, para pruebas automáticas.
  window.__estadoJuego = () => ({ fase, nivelIdx, mapa, jugador, chip, geo, puntosTotal });

  irAlInicio();
  requestAnimationFrame(cuadro);
})();
