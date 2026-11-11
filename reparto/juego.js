/* Reparto — minijuego del stand de Control Position (GoodRoute).
 *
 * El jugador reparte las órdenes del día entre varios técnicos. Cada técnico
 * arma solo su mejor ruta con lo que le tocó (ruta abierta óptima), así que
 * lo único que decide el jugador es QUIÉN hace cada orden: la asignación y el
 * equilibrio de carga. GoodRoute calcula el reparto óptimo probando todos.
 *
 * Todo lo que conviene ajustar tras probar con gente está en AJUSTES.
 */
(() => {
  "use strict";
  const C = window.Comun;

  const AJUSTES = {
    finJornada: 11 * 60,        // 8:00 → 19:00 (minutos)
    marcaBono: 10 * 60,         // 18:00: bono si todos terminan antes
    minutosServicio: 120,       // cada instalación
    minutosPorCuadra: 8,
    kmPorCuadra: 0.4,
    minutosPorSegundo: 90,      // velocidad del día al mostrar cómo resulta
    inactividadMs: 40000,
    rondas: [
      { tecnicos: 2, ordenes: 6, obras: 8,  segundos: 30 },
      { tecnicos: 3, ordenes: 9, obras: 14, segundos: 45 },
    ],
    puntosOrden: 100,           // por orden atendida
    puntosKm: 200,              // × (km GoodRoute / tus km) × (atendidas / total)
    bonoAntesDeLas18: 150,      // todas atendidas y nadie termina después de las 18:00
    bonoIgualar: 150,
    claveRanking: "reparto.ranking",
  };

  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $("hud"), hudRonda: $("hud-ronda"), hudAyuda: $("hud-ayuda"), hudCentro: $("hud-centro"),
    hudAsignadas: $("hud-asignadas"), btnListo: $("btn-listo"),
    panel: $("panel-barras"), barras: $("barras"),
    inicio: $("inicio"), aviso: $("aviso"), avisoTexto: $("aviso-texto"),
    resultado: $("resultado"), resTitulo: $("res-titulo"), resDetalle: $("res-detalle"), resPuntos: $("res-puntos"),
    rAtTu: $("r-at-tu"), rAtGr: $("r-at-gr"), rKmTu: $("r-km-tu"), rKmGr: $("r-km-gr"), rFinTu: $("r-fin-tu"), rFinGr: $("r-fin-gr"),
    btnSiguiente: $("btn-siguiente"),
    final: $("final"), finPuntos: $("fin-puntos"), finMensaje: $("fin-mensaje"), form: $("form-nombre"), nombre: $("nombre"),
    rankingInicio: $("ranking-inicio"), rankingFinal: $("ranking-final"),
  };
  const vista = new C.Vista($("mapa"));
  const ranking = new C.Ranking(AJUSTES.claveRanking);

  // ---------- Estado ----------
  let fase = "inicio";            // inicio | planificar | ejecutar | resultado | final
  let rondaIdx = 0, puntosTotal = 0, rondasIgualadas = 0;
  let mapa = null, bases = [], ordenes = [], rutas = [];
  let asignacion = [];            // por orden: índice de técnico o -1
  let selector = null;            // { orden, opciones: [{x, y, r, valor}] }
  let restante = 0, cuentaActiva = false;
  let reloj = 0;
  let planTu = null, planGr = null;

  const ronda = () => AJUSTES.rondas[rondaIdx];
  const nTec = () => ronda().tecnicos;

  // ---------- Reglas ----------
  const tiempoDe = (t, mask) => rutas[t].costo[mask] * AJUSTES.minutosPorCuadra + C.bits(mask) * AJUSTES.minutosServicio;

  /** Ruta de un técnico: orden óptimo; si no alcanza, las últimas quedan pendientes. */
  function evaluarTecnico(t, mask) {
    const seq = mask ? rutas[t].orden(mask) : [];
    let tiempo = 0, nodo = bases[t], cuadras = 0;
    const atendidas = [], pendientes = [];
    for (const i of seq) {
      if (pendientes.length) { pendientes.push(i); continue; }
      const d = mapa.dist(nodo, ordenes[i]);
      const fin = tiempo + d * AJUSTES.minutosPorCuadra + AJUSTES.minutosServicio;
      if (fin > AJUSTES.finJornada) { pendientes.push(i); continue; }
      atendidas.push(i); cuadras += d; tiempo = fin; nodo = ordenes[i];
    }
    const { tramos } = C.tramosDeRuta(mapa, bases[t], atendidas.map((i) => ordenes[i]), {
      minutosPorCuadra: AJUSTES.minutosPorCuadra,
      servicios: atendidas.map(() => AJUSTES.minutosServicio),
    });
    return { atendidas, pendientes, cuadras, fin: atendidas.length ? tiempo : null, tiempoTotal: mask ? tiempoDe(t, mask) : 0, tramos };
  }

  function evaluarReparto(asig) {
    const masks = new Array(nTec()).fill(0);
    asig.forEach((t, i) => { if (t >= 0) masks[t] |= 1 << i; });
    const tecs = masks.map((m, t) => evaluarTecnico(t, m));
    const atendidas = tecs.reduce((s, x) => s + x.atendidas.length, 0);
    const cuadras = tecs.reduce((s, x) => s + x.cuadras, 0);
    const fines = tecs.map((x) => x.fin).filter((f) => f != null);
    return { tecs, atendidas, cuadras, finMax: fines.length ? Math.max(...fines) : null, asig: asig.slice() };
  }

  /** Reparto óptimo: prueba todas las combinaciones (cada orden a un técnico o pendiente). */
  function optimizar() {
    const t0 = performance.now();
    const n = ordenes.length, k = nTec();
    const masks = new Array(k).fill(0), asig = new Array(n).fill(-1);
    let mejor = null;
    const mejorQue = (a, b) =>
      a.atendidas !== b.atendidas ? a.atendidas > b.atendidas :
      a.bono !== b.bono ? a.bono > b.bono : a.cuadras < b.cuadras;
    (function probar(i, atendidas) {
      if (i === n) {
        let cuadras = 0, finMax = 0;
        for (let t = 0; t < k; t++) if (masks[t]) { cuadras += rutas[t].costo[masks[t]]; finMax = Math.max(finMax, tiempoDe(t, masks[t])); }
        const r = { atendidas, cuadras, bono: atendidas === n && finMax <= AJUSTES.marcaBono };
        if (!mejor || mejorQue(r, mejor)) mejor = { ...r, asig: asig.slice() };
        return;
      }
      for (let t = 0; t < k; t++) {
        const nm = masks[t] | (1 << i);
        if (tiempoDe(t, nm) > AJUSTES.finJornada) continue;   // no cabe en la jornada
        masks[t] = nm; asig[i] = t;
        probar(i + 1, atendidas + 1);
        masks[t] ^= 1 << i; asig[i] = -1;
      }
      probar(i + 1, atendidas);                               // dejarla pendiente
    })(0, 0);
    return { ...evaluarReparto(mejor.asig), ms: performance.now() - t0 };
  }

  // ---------- Flujo ----------
  function mostrar(capa) { for (const c of [ui.inicio, ui.aviso, ui.resultado, ui.final]) c.hidden = c !== capa; }

  function irAlInicio() {
    fase = "inicio"; mapa = null; selector = null;
    ui.hud.hidden = true; ui.panel.hidden = true;
    ranking.pintar(ui.rankingInicio, null);
    mostrar(ui.inicio);
    ajustar();
  }

  function nuevaPartida() { rondaIdx = 0; puntosTotal = 0; rondasIgualadas = 0; empezarRonda(); }

  function empezarRonda() {
    const r = ronda();
    const v = C.vertical();
    mapa = C.crearCiudad({ cols: v ? 7 : 10, rows: v ? 9 : 7, obras: r.obras });
    bases = mapa.elegirBases(r.tecnicos);
    ordenes = mapa.elegirNodos(r.ordenes, bases, 2);
    rutas = bases.map((b) => C.rutasOptimas(mapa, b, ordenes));
    asignacion = new Array(ordenes.length).fill(-1);
    planGr = optimizar();
    planTu = evaluarReparto(asignacion);
    selector = null; reloj = 0;
    restante = r.segundos; cuentaActiva = false;
    fase = "planificar";
    ui.hud.hidden = false; ui.panel.hidden = false; ui.btnListo.hidden = false;
    ui.hudRonda.textContent = `Ronda ${rondaIdx + 1} de ${AJUSTES.rondas.length}`;
    ui.hudAyuda.textContent = "Toca una orden y elige quién la hace";
    actualizarPanel();
    ajustar();
    ui.avisoTexto.innerHTML = `Ronda ${rondaIdx + 1}<small>${r.tecnicos} técnicos · ${r.ordenes} órdenes · ${r.segundos} s</small>`;
    mostrar(ui.aviso);
    setTimeout(() => { if (fase === "planificar") { mostrar(null); cuentaActiva = true; } }, 1500);
  }

  function asignar(i, t) {
    asignacion[i] = t;
    planTu = evaluarReparto(asignacion);
    actualizarPanel();
  }

  function actualizarPanel() {
    ui.hudAsignadas.textContent = `${asignacion.filter((t) => t >= 0).length}/${ordenes.length}`;
    const items = planTu.tecs.map((x, t) => {
      const exceso = x.tiempoTotal - AJUSTES.finJornada;
      const nOrd = x.atendidas.length + x.pendientes.length;
      return {
        nombre: C.NOMBRES_TECNICOS[t], color: C.COLORES_TECNICOS[t],
        hasta: Math.min(x.tiempoTotal, AJUSTES.finJornada), exceso,
        ahora: fase === "ejecutar" || fase === "resultado" ? reloj : null,
        texto: !nOrd ? "sin órdenes" : exceso > 0 ? `${x.pendientes.length} no alcanza` : `${nOrd} · ${C.hhmm(x.tiempoTotal)}`,
      };
    });
    C.pintarBarras(ui.barras, items, { limite: AJUSTES.finJornada, marca: AJUSTES.marcaBono });
  }

  function terminarPlanificacion() {
    if (fase !== "planificar") return;
    fase = "ejecutar"; selector = null; reloj = 0;
    ui.btnListo.hidden = true;
    ui.hudAyuda.textContent = "Así resulta tu reparto";
    mostrar(null);
  }

  function terminarRonda() {
    fase = "resultado";
    const n = ordenes.length, tu = planTu, gr = planGr;
    const iguala = tu.atendidas >= gr.atendidas && tu.cuadras <= gr.cuadras;
    if (iguala) rondasIgualadas++;
    const eficiencia = tu.atendidas ? Math.min(1, gr.cuadras / Math.max(tu.cuadras, 1)) * (tu.atendidas / n) : 0;
    const bono = tu.atendidas === n && tu.finMax != null && tu.finMax <= AJUSTES.marcaBono;
    const puntos = tu.atendidas * AJUSTES.puntosOrden + Math.round(AJUSTES.puntosKm * eficiencia)
                 + (bono ? AJUSTES.bonoAntesDeLas18 : 0) + (iguala ? AJUSTES.bonoIgualar : 0);
    puntosTotal += puntos;

    ui.resTitulo.textContent = iguala ? "¡Igualaste a GoodRoute!" : tu.atendidas === n ? "Todo atendido" : "GoodRoute lo hizo mejor";
    ui.rAtTu.textContent = `${tu.atendidas}/${n}`; ui.rAtGr.textContent = `${gr.atendidas}/${n}`;
    ui.rKmTu.textContent = C.km(tu.cuadras, AJUSTES.kmPorCuadra); ui.rKmGr.textContent = C.km(gr.cuadras, AJUSTES.kmPorCuadra);
    ui.rFinTu.textContent = tu.finMax == null ? "—" : C.hhmm(tu.finMax); ui.rFinGr.textContent = gr.finMax == null ? "—" : C.hhmm(gr.finMax);
    const calculo = gr.ms < 1 ? "menos de 1 ms" : `${Math.round(gr.ms)} ms`;
    let detalle;
    if (iguala) detalle = `Encontraste el mejor reparto posible. GoodRoute lo calculó en ${calculo}.`;
    else {
      const p = [];
      const dAt = gr.atendidas - tu.atendidas;
      if (dAt > 0) p.push(`atendió ${dAt} ${dAt === 1 ? "orden" : "órdenes"} más`);
      if (tu.cuadras > gr.cuadras && tu.atendidas >= gr.atendidas) p.push(`recorrió ${C.km(tu.cuadras - gr.cuadras, AJUSTES.kmPorCuadra)} km menos`);
      detalle = (p.length ? `GoodRoute ${p.join(" y ")}` : "GoodRoute repartió distinto") + `, y lo calculó en ${calculo}.`;
      detalle += " Las letras naranjas muestran a quién le dio cada orden.";
    }
    ui.resDetalle.textContent = detalle;
    ui.resPuntos.textContent = puntos;
    ui.btnSiguiente.textContent = rondaIdx < AJUSTES.rondas.length - 1 ? "Siguiente ronda" : "Ver puntaje";
    ui.hudAyuda.textContent = "Naranjo: el reparto de GoodRoute";
    mostrar(ui.resultado);
  }

  function siguiente() {
    if (rondaIdx < AJUSTES.rondas.length - 1) { rondaIdx++; empezarRonda(); }
    else terminarPartida();
  }

  let registro = null;
  function terminarPartida() {
    fase = "final";
    ui.hud.hidden = true; ui.panel.hidden = true;
    ui.finPuntos.textContent = puntosTotal;
    const total = AJUSTES.rondas.length;
    ui.finMensaje.textContent =
      rondasIgualadas === total ? "Igualaste a GoodRoute en todas las rondas. Repartes como un jefe de operaciones." :
      rondasIgualadas > 0 ? `Igualaste a GoodRoute en ${rondasIgualadas} de ${total} rondas.` :
      "Equilibrar carga y kilómetros a la vez es difícil. Para eso está GoodRoute.";
    registro = null; ui.form.hidden = false; ui.nombre.value = "";
    ranking.pintar(ui.rankingFinal, null);
    mostrar(ui.final);
  }

  ui.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (registro) return;
    registro = ranking.agregar(ui.nombre.value, puntosTotal);
    ui.form.hidden = true; ui.nombre.blur();
    ranking.pintar(ui.rankingFinal, registro);
  });

  // ---------- Dibujo ----------
  function ajustar() {
    vista.ajustarLienzo();
    if (!mapa) return;
    const arriba = ui.hud.hidden ? 0 : ui.hud.offsetHeight;
    const abajo = ui.panel.hidden ? 0 : ui.panel.offsetHeight;
    vista.encuadrar(mapa, { x: 0, y: arriba, w: innerWidth, h: innerHeight - arriba - abajo }, Math.min(40, innerWidth * 0.07));
  }

  function dibujar() {
    vista.limpiar();
    if (!mapa) return;
    vista.ciudad();
    const c = vista.celda;
    const revisando = fase === "resultado";

    if (revisando) planGr.tecs.forEach((x) => vista.trazar(x.tramos, Infinity, C.COLOR.gr, Math.max(9, c * 0.14), 0.4));
    const hasta = fase === "planificar" ? Infinity : reloj;
    planTu.tecs.forEach((x, t) => vista.trazar(x.tramos, hasta, C.COLORES_TECNICOS[t], Math.max(4, c * 0.055), fase === "planificar" ? 0.45 : 0.9));

    bases.forEach((b, t) => vista.base(b, C.COLORES_TECNICOS[t], C.NOMBRES_TECNICOS[t][0]));

    const pendientes = new Set(planTu.tecs.flatMap((x) => x.pendientes));
    ordenes.forEach((n, i) => {
      const t = asignacion[i];
      const color = t >= 0 ? C.COLORES_TECNICOS[t] : C.COLOR.gris;
      let hecho = false;
      if (t >= 0 && fase !== "planificar") {
        const tr = planTu.tecs[t].tramos.find((x) => x.tipo === "servicio" && x.nodo === n);
        hecho = tr && reloj >= tr.t1;
      }
      const pend = pendientes.has(i) || (t < 0 && revisando);
      vista.pin(n, {
        relleno: hecho ? color : t >= 0 ? C.COLOR.blanco : C.COLOR.blanco,
        borde: pend ? C.COLOR.tarde : color,
        texto: hecho ? "✓" : pend && fase !== "planificar" ? "–" : t >= 0 ? C.NOMBRES_TECNICOS[t][0] : "",
        tinta: hecho ? C.COLOR.blanco : pend ? C.COLOR.tarde : color,
        discontinuo: pend || t < 0,
      });
      if (revisando) {
        const g = planGr.asig[i];
        const [x, y] = vista.px(n), r = Math.max(13, c * 0.2), er = r * 0.55;
        const ex = x + r * 0.95, ey = y + r * 0.8;
        const ctx = vista.ctx;
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fillStyle = C.COLOR.gr; ctx.fill();
        ctx.fillStyle = C.COLOR.blanco; ctx.font = `700 ${er * 1.1}px "IBM Plex Sans", sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(g >= 0 ? C.NOMBRES_TECNICOS[g][0] : "–", ex, ey + 1);
      }
    });

    if (fase !== "planificar") {
      planTu.tecs.forEach((x, t) => vista.furgon(vista.posicion(x.tramos, reloj, bases[t]), C.COLORES_TECNICOS[t]));
    }

    if (selector) dibujarSelector();
  }

  function dibujarSelector() {
    const ctx = vista.ctx, [x, y] = vista.px(ordenes[selector.orden]);
    const k = nTec(), radio = Math.max(46, vista.celda * 0.62), r = Math.max(19, vista.celda * 0.19);
    const total = k + 1;
    selector.opciones = [];
    ctx.beginPath(); ctx.arc(x, y, radio + r + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fill();
    ctx.strokeStyle = "#ece4e4"; ctx.lineWidth = 1; ctx.stroke();
    for (let j = 0; j < total; j++) {
      const ang = -Math.PI / 2 + (j / total) * Math.PI * 2;
      const ox = x + Math.cos(ang) * radio, oy = y + Math.sin(ang) * radio;
      const valor = j < k ? j : -1;
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fillStyle = valor >= 0 ? C.COLORES_TECNICOS[valor] : C.COLOR.gris; ctx.fill();
      if (asignacion[selector.orden] === valor) { ctx.lineWidth = 4; ctx.strokeStyle = C.COLOR.texto; ctx.stroke(); }
      ctx.fillStyle = C.COLOR.blanco;
      ctx.font = `700 ${r * 0.9}px "IBM Plex Sans", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(valor >= 0 ? C.NOMBRES_TECNICOS[valor][0] : "×", ox, oy + 1);
      selector.opciones.push({ x: ox, y: oy, r: r * 1.25, valor });
    }
  }

  // ---------- Entrada ----------
  vista.canvas.addEventListener("pointerdown", (e) => {
    if (fase !== "planificar" || !ui.aviso.hidden) return;
    if (selector) {
      const op = (selector.opciones || []).find((o) => Math.hypot(e.clientX - o.x, e.clientY - o.y) <= o.r);
      if (op) { asignar(selector.orden, op.valor); selector = null; return; }
    }
    const { indice, distancia } = vista.cercano(ordenes, e.clientX, e.clientY);
    selector = indice >= 0 && distancia < Math.max(28, vista.celda * 0.45) ? { orden: indice } : null;
  });
  ui.btnListo.addEventListener("click", terminarPlanificacion);
  $("btn-jugar").addEventListener("click", nuevaPartida);
  $("btn-otra").addEventListener("click", nuevaPartida);
  ui.btnSiguiente.addEventListener("click", siguiente);
  addEventListener("resize", ajustar);

  C.modoStand({
    inactividadMs: AJUSTES.inactividadMs,
    enJuego: () => fase !== "inicio",
    alInactivo: irAlInicio,
    ranking,
    alBorrar: () => ranking.pintar(ui.rankingInicio, null),
  });

  // ---------- Bucle ----------
  let anterior = performance.now();
  function cuadro(ahora) {
    const dt = Math.min((ahora - anterior) / 1000, 0.05);
    anterior = ahora;
    if (fase === "planificar" && cuentaActiva) {
      restante -= dt;
      const s = Math.max(0, Math.ceil(restante));
      ui.hudCentro.textContent = `0:${String(s).padStart(2, "0")}`;
      ui.hudCentro.classList.toggle("urgente", s <= 10);
      if (restante <= 0) terminarPlanificacion();
    } else if (fase === "ejecutar") {
      reloj += dt * AJUSTES.minutosPorSegundo;
      ui.hudCentro.textContent = C.hhmm(Math.min(reloj, AJUSTES.finJornada));
      ui.hudCentro.classList.remove("urgente");
      actualizarPanel();
      if (reloj >= (planTu.finMax ?? 0) + 30) { reloj = Math.max(reloj, planTu.finMax ?? 0); terminarRonda(); }
    }
    dibujar();
    requestAnimationFrame(cuadro);
  }

  window.__estadoJuego = () => ({ fase, rondaIdx, ordenes, asignacion, planGr, planTu, selector, vista, bases, puntosTotal });

  irAlInicio();
  requestAnimationFrame(cuadro);
})();
