/* Jornada Perfecta — minijuego del stand de Control Position (GoodRoute).
 *
 * El jugador arma el día de un técnico tocando a los clientes en orden.
 * Las reglas son las del producto: jornada 8:00–19:00, ventana de 30 min
 * antes a 15 min después de la hora acordada, tiempo de servicio y ruta
 * abierta. Al final de cada día se compara contra la ruta óptima de
 * GoodRoute, calculada de verdad (fuerza bruta sobre todos los órdenes).
 *
 * Todo lo que conviene ajustar tras probar con gente está en AJUSTES.
 */
(() => {
  "use strict";

  const AJUSTES = {
    // Reglas del día (minutos de juego)
    finJornada: 11 * 60,       // 8:00 → 19:00
    toleranciaAntes: 30,
    toleranciaDespues: 15,
    minutosServicio: 60,
    minutosPorCuadra: 5,
    kmPorCuadra: 0.4,

    // Ritmo
    minutosPorSegundo: 30,     // velocidad del reloj: 30 min de juego por segundo real
    inactividadMs: 40000,      // sin toques por este tiempo → vuelve al inicio

    // Días (niveles)
    dias: [
      { clientes: 4, conHora: 2, obras: 5 },    // de calentamiento
      { clientes: 5, conHora: 3, obras: 11 },
      { clientes: 6, conHora: 3, obras: 17 },
    ],
    // Holgura que se agrega entre visitas al generar las horas (min). Más
    // holgura = ventanas más separadas = más fácil acomodar a los sin hora.
    holguraGenerador: [0, 45],

    // Puntaje por día
    puntosATiempo: 100,
    puntosAtrasado: 30,
    puntosKm: 300,             // × (km GoodRoute / tus km) × (atendidos / total)
    bonoIgualar: 200,

    rankingMax: 10,
    claveRanking: "jornada-perfecta.ranking",
  };

  const COLOR = {
    calle: "#FBF6F6", manzana: "#ece4e4", manzanaBorde: "#e2d8d8",
    tu: "#033E84", tuSuave: "#e3ebf5", gr: "#e07419",
    ok: "#27945c", tarde: "#d8442f", aviso: "#d9930c", gris: "#9a968c",
    obra: "#d9930c", blanco: "#ffffff", base: "#1c1a1b", texto: "#1c1a1b",
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("mapa");
  const ctx = canvas.getContext("2d");
  const ui = {
    hud: $("hud"), hudDia: $("hud-dia"), hudAyuda: $("hud-ayuda"), hudReloj: $("hud-reloj"),
    cOk: $("c-ok"), cTarde: $("c-tarde"),
    inicio: $("inicio"), aviso: $("aviso"), avisoTexto: $("aviso-texto"),
    resultado: $("resultado"), resTitulo: $("res-titulo"), resDetalle: $("res-detalle"),
    resPuntos: $("res-puntos"), btnSiguiente: $("btn-siguiente"),
    rOkTu: $("r-ok-tu"), rOkGr: $("r-ok-gr"), rKmTu: $("r-km-tu"), rKmGr: $("r-km-gr"),
    rFinTu: $("r-fin-tu"), rFinGr: $("r-fin-gr"),
    final: $("final"), finPuntos: $("fin-puntos"), finMensaje: $("fin-mensaje"),
    form: $("form-nombre"), nombre: $("nombre"),
    rankingInicio: $("ranking-inicio"), rankingFinal: $("ranking-final"),
  };

  // ---------- Estado ----------
  let fase = "inicio";          // inicio | dia | resultado | final
  let diaIdx = 0;
  let puntosTotal = 0;
  let diasIgualados = 0;
  let mapa = null;              // { cols, rows, bloqueadas, base, clientes:[{nodo,hora}], arboles }
  let jugador = null;           // ver nuevoTecnico()
  let gr = null;                // { ...tecnico, orden, ms }
  let reloj = null;             // minutos desde las 8:00; null = el día aún no parte
  let ultimoToque = Date.now();
  let geo = { celda: 40, ox: 0, oy: 0 };

  // ---------- Utilidades ----------
  const azar = (n) => Math.floor(Math.random() * n);
  const entre = (a, b) => a + Math.random() * (b - a);
  const hhmm = (min) => {
    const t = Math.round(8 * 60 + min);
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  };
  const km = (cuadras) => (cuadras * AJUSTES.kmPorCuadra).toFixed(1).replace(".", ",");

  const id = (c, r) => r * mapa.cols + c;
  const col = (n) => n % mapa.cols;
  const fila = (n) => Math.floor(n / mapa.cols);
  const claveArista = (a, b) => (a < b ? a + "-" + b : b + "-" + a);

  function vecinos(n, bloqueadas) {
    const c = col(n), r = fila(n), out = [];
    if (c > 0) out.push(n - 1);
    if (c < mapa.cols - 1) out.push(n + 1);
    if (r > 0) out.push(n - mapa.cols);
    if (r < mapa.rows - 1) out.push(n + mapa.cols);
    return out.filter((v) => !bloqueadas.has(claveArista(n, v)));
  }

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

  // Camino más corto por las calles, sin incluir el nodo de partida.
  function camino(desde, hasta) {
    const { padre } = mapa.arboles.get(desde);
    const tramo = [];
    for (let n = hasta; n !== desde; n = padre[n]) tramo.push(n);
    return tramo.reverse();
  }

  // ---------- Reglas del día (las mismas para el jugador y para GoodRoute) ----------
  function nuevoTecnico() {
    return { nodo: mapa.base, libreDesde: 0, tramos: [], res: {}, elegidos: [], cuadras: 0 };
  }

  // Agrega la visita al cliente i. "ahora" es la hora en que se decide:
  // si el técnico ya estaba desocupado, sale recién en ese momento.
  function agregarVisita(tec, i, ahora) {
    const c = mapa.clientes[i];
    const salida = Math.max(tec.libreDesde, ahora);
    const tramo = camino(tec.nodo, c.nodo);
    const llegada = salida + tramo.length * AJUSTES.minutosPorCuadra;
    const abre = c.hora == null ? 0 : c.hora - AJUSTES.toleranciaAntes;
    const inicio = Math.max(llegada, abre);
    const fin = inicio + AJUSTES.minutosServicio;
    tec.elegidos.push(i);
    if (fin > AJUSTES.finJornada) {           // no alcanza dentro de la jornada
      tec.res[i] = { estado: "pendiente", desde: ahora };
      return;
    }
    tec.tramos.push({ tipo: "viaje", nodos: [tec.nodo, ...tramo], t0: salida, t1: llegada });
    if (inicio > llegada) tec.tramos.push({ tipo: "espera", nodo: c.nodo, t0: llegada, t1: inicio });
    tec.tramos.push({ tipo: "servicio", nodo: c.nodo, t0: inicio, t1: fin });
    const aTiempo = c.hora == null || llegada <= c.hora + AJUSTES.toleranciaDespues;
    tec.res[i] = { estado: aTiempo ? "ok" : "tarde", llegada, inicio, fin };
    tec.cuadras += tramo.length;
    tec.nodo = c.nodo;
    tec.libreDesde = fin;
  }

  function simular(orden) {
    const tec = nuevoTecnico();
    for (const i of orden) agregarVisita(tec, i, 0);
    return tec;
  }

  function resumen(tec) {
    let ok = 0, tarde = 0;
    for (const r of Object.values(tec.res)) { if (r.estado === "ok") ok++; else if (r.estado === "tarde") tarde++; }
    return { ok, tarde, atendidos: ok + tarde, cuadras: tec.cuadras, fin: tec.tramos.length ? tec.libreDesde : null };
  }

  // Mejor = más clientes a tiempo; luego más atendidos; luego menos km.
  const mejorQue = (a, b) =>
    a.ok !== b.ok ? a.ok > b.ok : a.atendidos !== b.atendidos ? a.atendidos > b.atendidos : a.cuadras < b.cuadras;

  // Óptimo exacto: prueba todos los órdenes (6 clientes = 720).
  function optimizar() {
    const t0 = performance.now();
    const n = mapa.clientes.length;
    let mejor = null, mejorRes = null;
    const orden = [], usado = new Array(n).fill(false);
    (function probar() {
      if (orden.length === n) {
        const tec = simular(orden), r = resumen(tec);
        if (!mejorRes || mejorQue(r, mejorRes)) { mejor = { tec, orden: orden.slice() }; mejorRes = r; }
        return;
      }
      for (let i = 0; i < n; i++) {
        if (usado[i]) continue;
        usado[i] = true; orden.push(i); probar(); orden.pop(); usado[i] = false;
      }
    })();
    return { ...mejor.tec, orden: mejor.orden, ms: performance.now() - t0 };
  }

  // ---------- Generación del día ----------
  function generarDia(dia) {
    for (let intento = 0; intento < 200; intento++) {
      if (intentarDia(dia)) return;
    }
    // Muy improbable: sin horas acordadas el día siempre es posible.
    mapa.clientes.forEach((c) => { c.hora = null; });
  }

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

  function intentarDia(dia) {
    const vertical = innerHeight > innerWidth * 1.1;
    const cols = vertical ? 6 : 9, rows = vertical ? 8 : 6;
    mapa = { cols, rows, bloqueadas: new Set(), cortes: new Set(), interiores: new Set(), edificios: [], base: 0, clientes: [], arboles: new Map() };
    ponerEdificios(Math.round(((cols - 1) * (rows - 1)) / 9));

    // Calles cortadas, sin dejar zonas aisladas.
    let intentos = 0;
    while (mapa.bloqueadas.size < dia.obras && intentos++ < 400) {
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

    // Base en un borde; clientes separados al menos 2 cuadras.
    const manhattan = (a, b) => Math.abs(col(a) - col(b)) + Math.abs(fila(a) - fila(b));
    const lado = azar(4);
    mapa.base = lado === 0 ? id(0, azar(rows)) : lado === 1 ? id(cols - 1, azar(rows))
              : lado === 2 ? id(azar(cols), 0) : id(azar(cols), rows - 1);
    const usados = [mapa.base];
    intentos = 0;
    while (mapa.clientes.length < dia.clientes && intentos++ < 2000) {
      const n = azar(cols * rows);
      if (!mapa.interiores.has(n) && usados.every((u) => manhattan(u, n) >= (intentos < 1500 ? 2 : 1))) {
        mapa.clientes.push({ nodo: n, hora: null }); usados.push(n);
      }
    }
    for (const n of usados) mapa.arboles.set(n, bfs(n, mapa.cortes));

    // Horas acordadas: se recorre a los clientes en un orden al azar (con
    // holguras) y a algunos se les fija una hora compatible con esa llegada.
    // Así siempre existe al menos un orden con todos a tiempo.
    const orden = mapa.clientes.map((_, i) => i).sort(() => Math.random() - 0.5);
    const conHora = new Set(orden.slice().sort(() => Math.random() - 0.5).slice(0, dia.conHora));
    let t = 0, nodo = mapa.base;
    for (const i of orden) {
      t += entre(...AJUSTES.holguraGenerador);
      const llegada = t + camino(nodo, mapa.clientes[i].nodo).length * AJUSTES.minutosPorCuadra;
      if (conHora.has(i)) {
        // hora ∈ [llegada, llegada + 30): llegar en ese recorrido queda dentro de la ventana
        mapa.clientes[i].hora = Math.ceil(llegada / 15) * 15 + 15 * azar(2);
      }
      t = Math.max(llegada, mapa.clientes[i].hora == null ? 0 : mapa.clientes[i].hora - AJUSTES.toleranciaAntes)
          + AJUSTES.minutosServicio;
      nodo = mapa.clientes[i].nodo;
    }
    if (t > AJUSTES.finJornada) return false;
    // Que no sea trivial: GoodRoute debe poder atender a todos a tiempo.
    const prueba = resumen(simular(orden));
    return prueba.ok === mapa.clientes.length;
  }

  // ---------- Geometría ----------
  function ajustarCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!mapa) return;
    const arriba = ui.hud.hidden ? 16 : ui.hud.offsetHeight + 24;
    const margen = Math.min(40, innerWidth * 0.08);   // deja espacio para las etiquetas de hora
    const ancho = innerWidth - margen * 2;
    const alto = innerHeight - arriba - margen * 2;
    geo.celda = Math.min(ancho / (mapa.cols - 1), alto / (mapa.rows - 1));
    geo.ox = (innerWidth - geo.celda * (mapa.cols - 1)) / 2;
    geo.oy = arriba + margen + (alto - geo.celda * (mapa.rows - 1)) / 2;
  }
  const px = (n) => [geo.ox + col(n) * geo.celda, geo.oy + fila(n) * geo.celda];

  // Posición del técnico a la hora t según sus tramos.
  function posicionTecnico(tec, t) {
    let ultimo = null;
    for (const tr of tec.tramos) {
      if (t < tr.t0) break;
      ultimo = tr;
      if (t <= tr.t1 && tr.tipo === "viaje") {
        const pasos = tr.nodos.length - 1;
        const s = pasos * ((t - tr.t0) / Math.max(tr.t1 - tr.t0, 1e-6));
        const i = Math.min(Math.floor(s), pasos - 1);
        const [x1, y1] = px(tr.nodos[i]), [x2, y2] = px(tr.nodos[i + 1]);
        const f = s - i;
        return { x: x1 + (x2 - x1) * f, y: y1 + (y2 - y1) * f, ang: Math.atan2(y2 - y1, x2 - x1) };
      }
    }
    const nodo = ultimo ? (ultimo.nodo ?? ultimo.nodos[ultimo.nodos.length - 1]) : mapa.base;
    const [x, y] = px(nodo);
    let ang = 0;
    for (let k = tec.tramos.length - 1; k >= 0; k--) {
      const tr = tec.tramos[k];
      if (tr.tipo === "viaje" && tr.t0 <= t && tr.nodos.length > 1) {
        const [ax, ay] = px(tr.nodos[tr.nodos.length - 2]), [bx, by] = px(tr.nodos[tr.nodos.length - 1]);
        ang = Math.atan2(by - ay, bx - ax); break;
      }
    }
    return { x, y, ang };
  }

  // ---------- Dibujo ----------
  function dibujar() {
    ctx.fillStyle = COLOR.calle;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    if (!mapa) return;
    const c = geo.celda, calle = Math.max(10, c * 0.26);
    const t = reloj ?? 0;

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

    // Calles cortadas
    for (const k of mapa.bloqueadas) {
      const [a, b] = k.split("-").map(Number);
      const [x1, y1] = px(a), [x2, y2] = px(b);
      ctx.save();
      ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
      if (x1 === x2) ctx.rotate(Math.PI / 2);
      const w = Math.max(6, c * 0.1), h = calle * 1.1;
      ctx.fillStyle = COLOR.obra; redondeado(-w / 2, -h / 2, w, h, 3); ctx.fill();
      ctx.fillStyle = COLOR.blanco;
      for (const s of [-1, 1]) ctx.fillRect(-w / 2, s * h / 4 - 1.5, w, 3);
      ctx.restore();
    }

    // Rutas: GoodRoute (solo al revisar) ancha y suave por debajo; la tuya encima.
    if (fase === "resultado" && gr) trazarTramos(gr.tramos, Infinity, COLOR.gr, Math.max(10, c * 0.15), 0.4);
    if (jugador) trazarTramos(jugador.tramos, t, COLOR.tu, Math.max(4, c * 0.06), 0.9);

    // Base
    const [bx, by] = px(mapa.base);
    const tb = Math.max(30, c * 0.46);
    ctx.fillStyle = COLOR.base; redondeado(bx - tb / 2, by - tb / 2, tb, tb, 7); ctx.fill();
    ctx.fillStyle = COLOR.blanco;
    ctx.font = `700 ${tb * 0.27}px "IBM Plex Sans", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("BASE", bx, by + 1);

    // Clientes
    mapa.clientes.forEach((cl, i) => dibujarCliente(cl, i, t));

    // Técnico
    if (jugador) furgon(posicionTecnico(jugador, t), Math.max(26, c * 0.38), COLOR.tu);
  }

  function dibujarCliente(cl, i, t) {
    const c = geo.celda;
    const [x, y] = px(cl.nodo);
    const rc = Math.max(14, c * 0.2);
    const pos = jugador.elegidos.indexOf(i);
    const res = jugador.res[i];
    const llego = res && res.llegada != null && t >= res.llegada;
    const estado = res?.estado === "pendiente" ? "pendiente"
                 : llego ? res.estado
                 : fase === "resultado" ? "sin" : null;

    // Anillo de servicio o de espera
    if (res && res.inicio != null && t >= res.llegada && t < res.fin) {
      const enServicio = t >= res.inicio;
      ctx.beginPath(); ctx.arc(x, y, rc + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(3,62,132,.15)"; ctx.lineWidth = 5; ctx.stroke();
      if (enServicio) {
        const f = (t - res.inicio) / (res.fin - res.inicio);
        ctx.beginPath(); ctx.arc(x, y, rc + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
        ctx.strokeStyle = COLOR.tu; ctx.stroke();
      }
    }

    // Círculo
    const relleno = estado === "ok" ? COLOR.ok : estado === "tarde" ? COLOR.tarde
                  : estado === "pendiente" || estado === "sin" ? COLOR.gris
                  : pos >= 0 ? COLOR.tu : COLOR.blanco;
    ctx.beginPath(); ctx.arc(x, y, rc, 0, Math.PI * 2);
    ctx.fillStyle = relleno; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = relleno === COLOR.blanco ? COLOR.tu : relleno; ctx.stroke();
    ctx.fillStyle = relleno === COLOR.blanco ? COLOR.tu : COLOR.blanco;
    ctx.font = `700 ${rc * 0.95}px "IBM Plex Sans", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const marca = estado === "ok" ? "✓" : estado === "tarde" ? "!" : estado === "pendiente" || estado === "sin" ? "–"
                : pos >= 0 ? String(pos + 1) : "";
    ctx.fillText(marca, x, y + 1);

    // Etiqueta de hora sobre el cliente
    const fs = Math.max(11, Math.min(17, c * 0.17));
    ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`;
    const texto = cl.hora == null ? "Sin hora" : hhmm(cl.hora);
    const w = ctx.measureText(texto).width + fs * 0.9, h = fs * 1.55;
    const ey = y - rc - h / 2 - 6;
    let fondo = cl.hora == null ? COLOR.tuSuave : COLOR.tu, tinta = cl.hora == null ? COLOR.tu : COLOR.blanco;
    if (cl.hora != null && !llego && fase === "dia" && reloj != null && res?.estado !== "pendiente") {
      if (t > cl.hora + AJUSTES.toleranciaDespues) { fondo = COLOR.tarde; }
      else if (t > cl.hora - AJUSTES.toleranciaAntes) {
        // ventana abierta: parpadea en ámbar
        fondo = Math.floor(performance.now() / 300) % 2 ? COLOR.aviso : COLOR.tu;
      }
    }
    if (estado === "ok") fondo = COLOR.ok, tinta = COLOR.blanco;
    if (estado === "tarde") fondo = COLOR.tarde, tinta = COLOR.blanco;
    if (estado === "pendiente" || estado === "sin") fondo = COLOR.gris, tinta = COLOR.blanco;
    redondeado(x - w / 2, ey - h / 2, w, h, h / 2); ctx.fillStyle = fondo; ctx.fill();
    ctx.fillStyle = tinta; ctx.fillText(texto, x, ey + 1);

    // Orden de GoodRoute al revisar
    if (fase === "resultado" && gr) {
      const k = gr.orden.indexOf(i) + 1;
      const ex = x + rc * 0.95, ey2 = y + rc * 0.8, er = rc * 0.52;
      ctx.beginPath(); ctx.arc(ex, ey2, er, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.gr; ctx.fill();
      ctx.fillStyle = COLOR.blanco;
      ctx.font = `700 ${er * 1.15}px "IBM Plex Sans", sans-serif`;
      ctx.fillText(String(k), ex, ey2 + 1);
    }
  }

  function trazarTramos(tramos, hasta, color, grosor, alfa) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.globalAlpha = alfa;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const tr of tramos) {
      if (tr.tipo !== "viaje" || tr.t0 > hasta || tr.nodos.length < 2) continue;
      ctx.beginPath();
      const pasos = tr.nodos.length - 1;
      const s = hasta >= tr.t1 ? pasos : pasos * (hasta - tr.t0) / Math.max(tr.t1 - tr.t0, 1e-6);
      for (let k = 0; k <= Math.floor(s); k++) {
        const [x, y] = px(tr.nodos[k]);
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      if (s < pasos) {
        const i = Math.floor(s), f = s - i;
        const [x1, y1] = px(tr.nodos[i]), [x2, y2] = px(tr.nodos[i + 1]);
        ctx.lineTo(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function furgon({ x, y, ang }, largo, color) {
    const ancho = largo * 0.6;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = color;
    redondeado(-largo / 2, -ancho / 2, largo, ancho, ancho * 0.25); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,255,255,.9)";                         // parabrisas
    redondeado(largo * 0.18, -ancho * 0.36, largo * 0.18, ancho * 0.72, 3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";                        // carga
    ctx.fillRect(-largo * 0.4, -ancho * 0.3, largo * 0.48, ancho * 0.6);
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

  // ---------- Flujo ----------
  const diaActual = () => AJUSTES.dias[diaIdx];

  function mostrar(capa) {
    for (const c of [ui.inicio, ui.aviso, ui.resultado, ui.final]) c.hidden = c !== capa;
  }

  function irAlInicio() {
    fase = "inicio";
    mapa = null; jugador = null; gr = null; reloj = null;
    ui.hud.hidden = true;
    pintarRanking(ui.rankingInicio, null);
    mostrar(ui.inicio);
    ajustarCanvas();
  }

  function nuevaPartida() {
    diaIdx = 0; puntosTotal = 0; diasIgualados = 0;
    empezarDia();
  }

  function empezarDia() {
    const dia = diaActual();
    generarDia(dia);
    gr = optimizar();
    jugador = nuevoTecnico();
    reloj = null;
    fase = "dia";
    ui.hud.hidden = false;
    ui.hudDia.textContent = `Día ${diaIdx + 1} de ${AJUSTES.dias.length}`;
    ui.hudAyuda.textContent = "Toca el primer cliente para empezar el día";
    actualizarHud();
    ajustarCanvas();
    ui.avisoTexto.innerHTML = `Día ${diaIdx + 1}<small>${dia.clientes} clientes · ${dia.conHora} con hora acordada</small>`;
    mostrar(ui.aviso);
    setTimeout(() => { if (fase === "dia" && !ui.aviso.hidden) mostrar(null); }, 1600);
  }

  function tocarCliente(i) {
    if (jugador.elegidos.includes(i)) return;
    if (reloj == null) { reloj = 0; mostrar(null); }
    agregarVisita(jugador, i, reloj);
    const faltan = mapa.clientes.length - jugador.elegidos.length;
    ui.hudAyuda.textContent = jugador.res[i].estado === "pendiente"
      ? "No alcanza antes de las 19:00: queda pendiente"
      : faltan ? `Faltan ${faltan} por ordenar` : "Día armado: mira cómo resulta";
  }

  function actualizarHud() {
    const t = reloj ?? 0;
    ui.hudReloj.textContent = hhmm(Math.min(t, AJUSTES.finJornada));
    ui.hudReloj.classList.toggle("tarde", t >= AJUSTES.finJornada - 60);
    let ok = 0, tarde = 0;
    for (const r of Object.values(jugador.res)) {
      if (r.llegada != null && t >= r.llegada) { if (r.estado === "ok") ok++; else tarde++; }
    }
    ui.cOk.textContent = ok; ui.cTarde.textContent = tarde;
  }

  function avanzar(dt) {
    if (fase !== "dia" || reloj == null) return;
    reloj += dt * AJUSTES.minutosPorSegundo;
    const todosDecididos = jugador.elegidos.length === mapa.clientes.length;
    // Si ya está todo decidido, adelanta un poco el tramo final para no aburrir.
    if (todosDecididos) reloj += dt * AJUSTES.minutosPorSegundo * 0.5;
    actualizarHud();
    if ((todosDecididos && reloj >= jugador.libreDesde) || reloj >= AJUSTES.finJornada) terminarDia();
  }

  function terminarDia() {
    fase = "resultado";
    reloj = Math.max(reloj, jugador.libreDesde);
    actualizarHud();
    const n = mapa.clientes.length;
    const tu = resumen(jugador), go = resumen(gr);

    const iguala = tu.ok >= go.ok && tu.atendidos >= go.atendidos && tu.cuadras <= go.cuadras;
    if (iguala) diasIgualados++;
    const eficiencia = tu.atendidos ? Math.min(1, go.cuadras / Math.max(tu.cuadras, 1)) * (tu.atendidos / n) : 0;
    const puntos = tu.ok * AJUSTES.puntosATiempo + tu.tarde * AJUSTES.puntosAtrasado
                 + Math.round(AJUSTES.puntosKm * eficiencia) + (iguala ? AJUSTES.bonoIgualar : 0);
    puntosTotal += puntos;

    ui.resTitulo.textContent = iguala ? "¡Igualaste a GoodRoute!" : tu.ok === n ? "¡Todos a tiempo!" : "GoodRoute lo hizo mejor";
    ui.rOkTu.textContent = `${tu.ok}/${n}`; ui.rOkGr.textContent = `${go.ok}/${n}`;
    ui.rKmTu.textContent = km(tu.cuadras); ui.rKmGr.textContent = km(go.cuadras);
    ui.rFinTu.textContent = tu.fin == null ? "—" : hhmm(tu.fin); ui.rFinGr.textContent = hhmm(go.fin);

    const calculo = gr.ms < 1 ? "menos de 1 ms" : `${Math.round(gr.ms)} ms`;
    let detalle;
    if (iguala) detalle = `Igualaste la mejor ruta posible. GoodRoute la calculó en ${calculo}.`;
    else {
      const partes = [];
      const dOk = go.ok - tu.ok, dKm = (tu.cuadras - go.cuadras) * AJUSTES.kmPorCuadra;
      if (dOk > 0) partes.push(`atendió ${dOk} ${dOk === 1 ? "cliente" : "clientes"} más a tiempo`);
      if (dKm > 0.05) partes.push(`recorrió ${km(tu.cuadras - go.cuadras)} km menos`);
      detalle = partes.length
        ? `GoodRoute ${partes.join(" y ")}, y lo calculó en ${calculo}.`
        : `GoodRoute priorizó llegar a tiempo, aunque recorriera más. Lo calculó en ${calculo}.`;
      detalle += " Los números naranjos muestran su orden.";
    }
    ui.resDetalle.textContent = detalle;
    ui.resPuntos.textContent = puntos;
    ui.btnSiguiente.textContent = diaIdx < AJUSTES.dias.length - 1 ? "Siguiente día" : "Ver puntaje";
    ui.hudAyuda.textContent = "Naranjo: la ruta de GoodRoute";
    mostrar(ui.resultado);
  }

  function siguiente() {
    if (diaIdx < AJUSTES.dias.length - 1) { diaIdx++; empezarDia(); }
    else terminarPartida();
  }

  let registroActual = null;
  function terminarPartida() {
    fase = "final";
    ui.hud.hidden = true;
    ui.finPuntos.textContent = puntosTotal;
    const total = AJUSTES.dias.length;
    ui.finMensaje.textContent =
      diasIgualados === total ? "Igualaste a GoodRoute los tres días. Tienes ojo de despachador." :
      diasIgualados > 0 ? `Igualaste a GoodRoute en ${diasIgualados} de ${total} días.` :
      "Cuadrar horas, distancias y jornada a la vez es difícil. Para eso está GoodRoute.";
    registroActual = null;
    ui.form.hidden = false;
    ui.nombre.value = "";
    pintarRanking(ui.rankingFinal, null);
    mostrar(ui.final);
  }

  // ---------- Ranking (localStorage de este navegador) ----------
  function leerRanking() {
    try { return JSON.parse(localStorage.getItem(AJUSTES.claveRanking)) || []; } catch { return []; }
  }
  function guardarRanking(lista) {
    try { localStorage.setItem(AJUSTES.claveRanking, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  }
  const escapar = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function pintarRanking(el, resaltado) {
    const lista = leerRanking();
    if (!lista.length) { el.innerHTML = ""; return; }
    el.innerHTML = "<h3>Mejores puntajes</h3><ol>" + lista.map((r, i) =>
      `<li class="${resaltado && r.t === resaltado.t ? "tuyo" : ""}"><span class="pos">${i + 1}</span>` +
      `<span>${escapar(r.nombre)}</span><span class="pts">${r.puntos}</span></li>`).join("") + "</ol>";
  }

  ui.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (registroActual) return;
    registroActual = { nombre: ui.nombre.value.trim().slice(0, 14) || "Anónimo", puntos: puntosTotal, t: Date.now() };
    guardarRanking([...leerRanking(), registroActual]
      .sort((a, b) => b.puntos - a.puntos || a.t - b.t).slice(0, AJUSTES.rankingMax));
    ui.form.hidden = true;
    ui.nombre.blur();
    pintarRanking(ui.rankingFinal, registroActual);
  });

  // ---------- Entrada ----------
  canvas.addEventListener("pointerdown", (e) => {
    if (fase !== "dia" || !mapa) return;
    let mejor = null, mejorD = Infinity;
    mapa.clientes.forEach((cl, i) => {
      if (jugador.elegidos.includes(i)) return;
      const [x, y] = px(cl.nodo);
      // la etiqueta de hora queda arriba del círculo: también cuenta como toque
      const d = Math.min(Math.hypot(e.clientX - x, e.clientY - y), Math.hypot(e.clientX - x, e.clientY - (y - geo.celda * 0.35)));
      if (d < mejorD) { mejorD = d; mejor = i; }
    });
    if (mejor != null && mejorD < geo.celda * 0.5) tocarCliente(mejor);
  });
  for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { ultimoToque = Date.now(); }, true);

  $("btn-jugar").addEventListener("click", nuevaPartida);
  $("btn-otra").addEventListener("click", nuevaPartida);
  ui.btnSiguiente.addEventListener("click", siguiente);
  $("btn-pantalla").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });

  // Mantener presionado el logo 3 s borra el ranking.
  let temporizadorBorrar = null;
  $("logo").addEventListener("pointerdown", () => {
    temporizadorBorrar = setTimeout(() => {
      if (confirm("¿Borrar el ranking del stand?")) { guardarRanking([]); pintarRanking(ui.rankingInicio, null); }
    }, 3000);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) $("logo").addEventListener(ev, () => clearTimeout(temporizadorBorrar));

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
  window.__estadoJuego = () => ({ fase, diaIdx, mapa, jugador, gr, geo, reloj, puntosTotal });

  irAlInicio();
  requestAnimationFrame(cuadro);
})();
