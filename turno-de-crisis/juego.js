/* Turno de Crisis — minijuego GRUPAL por turnos del stand (GoodRoute).
 *
 * Versión grupal de Día Imprevisto, pensada para un stand con UN solo mouse.
 * Tres técnicos salen con su ruta ya planificada y durante el día ocurren
 * imprevistos (un técnico se enferma, entra una orden urgente, un trabajo se
 * alarga). De 2 a 4 personas se turnan: cada imprevisto le toca a una persona,
 * que toma el mouse y tiene unos segundos para decidir. Cada uno resuelve 2.
 * Después de cada decisión, el orden de visitas de cada técnico se recalcula solo.
 *
 * El día es del equipo (todas las decisiones suman), pero cada decisión queda a
 * nombre de quien la tomó, así que al final se ve el aporte de cada persona.
 *
 * Cada opción se evalúa simulando el resto del día, así que "la mejor opción"
 * es real. Al final se compara con un día paralelo en que GoodRoute tomó
 * todas las decisiones frente a los mismos imprevistos.
 *
 * Todo lo que conviene ajustar tras probar con gente está en AJUSTES.
 */
(() => {
  "use strict";
  const C = window.Comun;

  const AJUSTES = {
    finJornada: 11 * 60,        // 8:00 → 19:00 (minutos)
    minutosServicio: 60,
    minutosPorCuadra: 6,
    kmPorCuadra: 0.4,
    ordenesPorTecnico: 5,
    obras: 12,
    minutosPorSegundo: 20,      // velocidad del reloj del día
    segundosDecision: 7,        // un poco más que en Día Imprevisto: hay que tomar el mouse
    segundosCambio: 1.8,        // aviso "Le toca a…" antes de cada imprevisto
    imprevistosPorJugador: 2,
    primerImprevisto: 75,       // 9:15
    ultimoImprevisto: 480,      // 16:00; los demás se reparten entre medio
    // Se usan los primeros (2 × jugadores) y se barajan. Solo un técnico puede enfermarse.
    tiposImprevisto: ["enfermo", "urgente", "alarga", "urgente", "alarga", "urgente", "urgente", "alarga"],
    margenUrgente: [120, 180],  // la urgente debe atenderse entre 2 y 3 h después de avisar
    minutosAlargue: 60,
    puntosATiempo: 100,
    puntosAtrasada: 30,
    castigoPendiente: 50,
    bonoAcierto: 50,            // por elegir la mejor opción…
    bonoRapidez: 10,            // …más esto por cada segundo que te sobró
    inactividadMs: 40000,
    claveRanking: "turno-de-crisis.ranking",
    claveJugadores: "turno-de-crisis.jugadores",
  };
  // Colores de los jugadores: distintos de los técnicos (azul, verde y morado).
  const JUGADORES = [
    { nombre: "Turquesa", color: "#0f8b8d" },
    { nombre: "Rosa", color: "#c23b7a" },
    { nombre: "Mostaza", color: "#b7791f" },
    { nombre: "Grafito", color: "#475569" },
  ];
  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
  const L = AJUSTES.finJornada;

  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $("hud"), hudAyuda: $("hud-ayuda"), hudReloj: $("hud-reloj"), hudHechas: $("hud-hechas"), hudPend: $("hud-pend"),
    panel: $("panel-barras"), barras: $("barras"),
    inicio: $("inicio"), aviso: $("aviso"), avisoTexto: $("aviso-texto"),
    decision: $("decision"), decQuien: $("dec-quien"), decHora: $("dec-hora"), elegir: $("elegir-jugadores"), aportes: $("aportes"), decTitulo: $("dec-titulo"), decTexto: $("dec-texto"),
    opciones: $("opciones"), cuentaBarra: $("cuenta-barra"),
    resultado: $("resultado"), resTitulo: $("res-titulo"), resDetalle: $("res-detalle"), resPuntos: $("res-puntos"),
    rOkTu: $("r-ok-tu"), rOkGr: $("r-ok-gr"), rPeTu: $("r-pe-tu"), rPeGr: $("r-pe-gr"), rKmTu: $("r-km-tu"), rKmGr: $("r-km-gr"),
    decisiones: $("decisiones"), btnSiguiente: $("btn-siguiente"),
    final: $("final"), finPuntos: $("fin-puntos"), finMensaje: $("fin-mensaje"), form: $("form-nombre"), nombre: $("nombre"),
    rankingInicio: $("ranking-inicio"), rankingFinal: $("ranking-final"),
  };
  const vista = new C.Vista($("mapa"));
  const ranking = new C.Ranking(AJUSTES.claveRanking);
  const NOMBRE = C.NOMBRES_TECNICOS, COLOR_T = C.COLORES_TECNICOS;

  // ---------- Estado ----------
  let fase = "inicio";            // inicio | aviso | dia | cambio | decidir | resultado | final
  let nJug = Math.min(4, Math.max(2, leer(AJUSTES.claveJugadores, 3)));
  let finCambio = 0;
  let mapa = null;
  let est = null;                 // estado del día del jugador (datos planos, clonable)
  let estGr = null;               // día paralelo con las decisiones de GoodRoute
  let eventos = [], proximo = 0;
  let reloj = 0;
  let decisionActual = null;      // { evento, opciones, evals, mejor, peor, inicio }
  let decisiones = [];
  let puntosTotal = 0;

  // ---------- Reglas del día ----------
  // Visita: { o, estado: "plan" | "pendiente" | "abortada", salida, llegada, inicio, fin, nodos }

  function trazarCola(e, nodo, t, ids) {
    const out = [];
    for (const id of ids) {
      const o = e.ordenes[id];
      const nodos = mapa.camino(nodo, o.nodo);
      const llegada = t + (nodos.length - 1) * AJUSTES.minutosPorCuadra;
      const fin = llegada + o.servicio;
      if (fin > L) { out.push({ o: id, estado: "pendiente", salida: Infinity }); continue; }
      out.push({ o: id, estado: "plan", salida: t, llegada, inicio: llegada, fin, nodos });
      t = fin; nodo = o.nodo;
    }
    return out;
  }

  function medir(e, visitas) {
    let ok = 0, tarde = 0, pend = 0, cuadras = 0;
    for (const v of visitas) {
      if (v.estado === "pendiente") pend++;
      else if (v.estado === "plan") {
        const lim = e.ordenes[v.o].limite;
        if (lim == null || v.llegada <= lim) ok++; else tarde++;
        cuadras += v.nodos.length - 1;
      }
    }
    return { ok, tarde, pend, atendidas: ok + tarde, cuadras };
  }
  const mejorQue = (a, b) =>
    a.ok !== b.ok ? a.ok > b.ok : a.atendidas !== b.atendidas ? a.atendidas > b.atendidas : a.cuadras < b.cuadras;

  /** Mejor orden para una cola: exacto hasta 7 órdenes; si son más, ruta más corta y se reubican las urgentes. */
  function mejorOrden(e, nodo, t, ids) {
    if (ids.length <= 1) return ids.slice();
    const evaluar = (orden) => medir(e, trazarCola(e, nodo, t, orden));
    if (ids.length <= 7) {
      let mejor = null, mejorM = null;
      const usado = new Array(ids.length).fill(false), orden = [];
      (function probar() {
        if (orden.length === ids.length) {
          const m = evaluar(orden);
          if (!mejorM || mejorQue(m, mejorM)) { mejor = orden.slice(); mejorM = m; }
          return;
        }
        for (let i = 0; i < ids.length; i++) {
          if (usado[i]) continue;
          usado[i] = true; orden.push(ids[i]); probar(); orden.pop(); usado[i] = false;
        }
      })();
      return mejor;
    }
    const r = C.rutasOptimas(mapa, nodo, ids.map((id) => e.ordenes[id].nodo));
    let mejor = r.orden((1 << ids.length) - 1).map((j) => ids[j]);
    let mejorM = evaluar(mejor);
    for (const id of ids.filter((x) => e.ordenes[x].limite != null)) {
      const sin = mejor.filter((x) => x !== id);
      for (let p = 0; p <= sin.length; p++) {
        const cand = [...sin.slice(0, p), id, ...sin.slice(p)];
        const m = evaluar(cand);
        if (mejorQue(m, mejorM)) { mejor = cand; mejorM = m; }
      }
    }
    return mejor;
  }

  /** Lo que el técnico ya no puede cambiar a la hora T y desde dónde/cuándo sigue. */
  function corte(e, tec) {
    const fijas = tec.visitas.filter((v) => v.estado === "abortada" || (v.estado === "plan" && v.salida <= e.T));
    const cola = tec.visitas.filter((v) => v.estado === "pendiente" || (v.estado === "plan" && v.salida > e.T)).map((v) => v.o);
    const ultima = [...fijas].reverse().find((v) => v.estado === "plan");
    const nodo = ultima ? e.ordenes[ultima.o].nodo : tec.base;
    const t = Math.max(ultima ? ultima.fin : 0, e.T);
    return { fijas, cola, nodo, t };
  }

  function replanificar(e, ti, colaNueva) {
    const tec = e.tecs[ti];
    const { fijas, cola, nodo, t } = corte(e, tec);
    const ids = colaNueva ?? cola;
    tec.visitas = [...fijas, ...trazarCola(e, nodo, t, mejorOrden(e, nodo, t, ids))];
  }

  function medirDia(e) {
    const m = medir(e, e.tecs.flatMap((t) => t.visitas));
    m.pend += e.sinAsignar.length;
    return m;
  }

  // ---------- Imprevistos ----------
  const activos = (e) => e.tecs.map((t, i) => i).filter((i) => e.tecs[i].activo);

  function enfermar(e, X) {
    const tec = e.tecs[X], pool = [];
    const quedan = [];
    for (const v of tec.visitas) {
      if (v.estado === "plan" && v.inicio <= e.T) quedan.push(v);              // ya está atendiendo: termina
      else if (v.estado === "plan" && v.salida <= e.T) { v.estado = "abortada"; quedan.push(v); pool.push(v.o); }
      else pool.push(v.o);
    }
    tec.visitas = quedan; tec.activo = false; tec.enfermoEn = e.T;
    return pool;
  }

  /** Arma las opciones de un imprevisto para el estado e. Cada opción tiene aplicar(e). */
  function construir(e, ev) {
    const act = activos(e);
    let tipo = ev.tipo;
    let X = ev.tec;
    if (tipo === "enfermo") {
      if (!e.tecs[X].activo) X = act[0];
      if (act.length < 3) tipo = "urgente";
    }
    let enCurso = null;
    if (tipo === "alarga") {
      // al técnico activo que esté trabajando y tenga más órdenes por delante
      const cand = act.map((i) => {
        const v = e.tecs[i].visitas.find((x) => x.estado === "plan" && x.salida <= e.T && x.fin > e.T);
        return { i, v, resto: corte(e, e.tecs[i]).cola.length };
      }).filter((c) => c.v && c.resto > 0).sort((a, b) => b.resto - a.resto);
      if (cand.length) { X = cand[0].i; enCurso = cand[0].v.o; } else tipo = "urgente";
    }

    if (tipo === "enfermo") {
      const otros = act.filter((i) => i !== X);
      const n = enfermar(structuredClone(e), X).length;
      const [Y, Z] = otros;
      const repartir = (ee, pool) => {
        const cY = corte(ee, ee.tecs[Y]), cZ = corte(ee, ee.tecs[Z]);
        const aY = [], aZ = [];
        for (const id of pool) (mapa.dist(cY.nodo, ee.ordenes[id].nodo) <= mapa.dist(cZ.nodo, ee.ordenes[id].nodo) ? aY : aZ).push(id);
        replanificar(ee, Y, [...cY.cola, ...aY]); replanificar(ee, Z, [...cZ.cola, ...aZ]);
      };
      return {
        titulo: `${NOMBRE[X]} se enfermó`,
        texto: `${NOMBRE[X]} se va a casa. ¿Quién toma sus ${n} ${n === 1 ? "orden" : "órdenes"}?`,
        foco: null,
        opciones: [
          { etiqueta: `Todo a ${NOMBRE[Y]}`, color: COLOR_T[Y], aplicar: (ee) => { const p = enfermar(ee, X); replanificar(ee, Y, [...corte(ee, ee.tecs[Y]).cola, ...p]); } },
          { etiqueta: `Todo a ${NOMBRE[Z]}`, color: COLOR_T[Z], aplicar: (ee) => { const p = enfermar(ee, X); replanificar(ee, Z, [...corte(ee, ee.tecs[Z]).cola, ...p]); } },
          { etiqueta: `Repartir entre ${NOMBRE[Y]} y ${NOMBRE[Z]}`, color: null, aplicar: (ee) => repartir(ee, enfermar(ee, X)) },
        ],
      };
    }

    if (tipo === "alarga") {
      const otros = act.filter((i) => i !== X);
      const alargar = (ee) => {
        ee.ordenes[enCurso].servicio += AJUSTES.minutosAlargue;
        const v = ee.tecs[X].visitas.find((x) => x.o === enCurso && x.estado === "plan");
        v.fin += AJUSTES.minutosAlargue;
      };
      const pasarA = (Y) => (ee) => {
        alargar(ee);
        const cX = corte(ee, ee.tecs[X]);
        const [prox, ...resto] = cX.cola;
        replanificar(ee, X, resto);
        replanificar(ee, Y, [...corte(ee, ee.tecs[Y]).cola, prox]);
      };
      return {
        titulo: `Se complicó un trabajo de ${NOMBRE[X]}`,
        texto: `Su trabajo actual se alarga ${AJUSTES.minutosAlargue / 60} hora. ¿Qué haces con lo que le queda?`,
        foco: e.ordenes[enCurso].nodo,
        opciones: [
          { etiqueta: `${NOMBRE[X]} sigue con todo`, color: COLOR_T[X], aplicar: (ee) => { alargar(ee); replanificar(ee, X); } },
          ...otros.map((Y) => ({ etiqueta: `Su próxima orden a ${NOMBRE[Y]}`, color: COLOR_T[Y], aplicar: pasarA(Y) })),
        ],
      };
    }

    // Urgente
    const limite = e.T + ev.margen;
    const nueva = (ee) => { ee.ordenes.push({ nodo: ev.nodo, servicio: AJUSTES.minutosServicio, limite, urgente: true }); return ee.ordenes.length - 1; };
    return {
      titulo: "Entró una orden urgente",
      texto: `Hay que llegar antes de las ${C.hhmm(limite)}. ¿Quién la toma?`,
      foco: ev.nodo,
      opciones: [
        ...act.map((Y) => ({ etiqueta: `${NOMBRE[Y]}`, color: COLOR_T[Y], aplicar: (ee) => { const id = nueva(ee); replanificar(ee, Y, [...corte(ee, ee.tecs[Y]).cola, id]); } })),
        { etiqueta: "Dejarla pendiente", color: C.COLOR.gris, aplicar: (ee) => { ee.sinAsignar.push(nueva(ee)); } },
      ],
    };
  }

  /** Evalúa cada opción simulando el resto del día. */
  function evaluar(e, imp) {
    const evals = imp.opciones.map((op) => { const c = structuredClone(e); op.aplicar(c); return medirDia(c); });
    let mejor = 0, peor = 0;
    evals.forEach((m, i) => { if (mejorQue(m, evals[mejor])) mejor = i; if (mejorQue(evals[peor], m)) peor = i; });
    return { evals, mejor, peor };
  }

  // ---------- Generación ----------
  function generarDia() {
    const v = C.vertical();
    mapa = C.crearCiudad({ cols: v ? 7 : 10, rows: v ? 10 : 7, obras: AJUSTES.obras });
    const bases = mapa.elegirBases(3);
    const nOrd = AJUSTES.ordenesPorTecnico * 3;
    const nodos = mapa.elegirNodos(nOrd, bases, 2);
    const k = AJUSTES.imprevistosPorJugador * nJug;
    const extra = mapa.elegirNodos(k, [...bases, ...nodos], 1);
    const e = {
      T: 0, sinAsignar: [],
      ordenes: nodos.map((nodo) => ({ nodo, servicio: AJUSTES.minutosServicio, limite: null, urgente: false })),
      tecs: bases.map((base) => ({ base, activo: true, enfermoEn: null, visitas: [] })),
    };
    // Plan inicial: cada técnico va tomando la orden libre más cercana a su base, por turnos.
    const libres = new Set(e.ordenes.map((_, i) => i));
    const asig = bases.map(() => []);
    for (let r = 0; r < AJUSTES.ordenesPorTecnico; r++) {
      bases.forEach((b, t) => {
        let mejor = null;
        for (const i of libres) if (mejor == null || mapa.dist(b, e.ordenes[i].nodo) < mapa.dist(b, e.ordenes[mejor].nodo)) mejor = i;
        if (mejor != null) { asig[t].push(mejor); libres.delete(mejor); }
      });
    }
    asig.forEach((ids, t) => { e.tecs[t].visitas = trazarCola(e, bases[t], 0, mejorOrden(e, bases[t], 0, ids)); });

    const tipos = C.barajar(AJUSTES.tiposImprevisto.slice(0, k));
    const paso = (AJUSTES.ultimoImprevisto - AJUSTES.primerImprevisto) / Math.max(1, k - 1);
    eventos = tipos.map((tipo, i) => ({
      t: Math.round((AJUSTES.primerImprevisto + paso * i) / 15) * 15, tipo,
      jugador: i % nJug,                      // por turnos: 1, 2, 3, 1, 2, 3…
      tec: C.azar(3),
      nodo: extra[i],
      margen: AJUSTES.margenUrgente[0] + 15 * C.azar((AJUSTES.margenUrgente[1] - AJUSTES.margenUrgente[0]) / 15 + 1),
    }));
    return e;
  }

  /** Día paralelo: GoodRoute decide cada imprevisto con la mejor opción. */
  function jugarGoodRoute(e0) {
    const t0 = performance.now();
    const e = structuredClone(e0);
    for (const ev of eventos) {
      e.T = ev.t;
      const imp = construir(e, ev);
      const { mejor } = evaluar(e, imp);
      imp.opciones[mejor].aplicar(e);
    }
    return { e, ms: performance.now() - t0 };
  }

  // ---------- Flujo ----------
  function mostrar(capa) { for (const c of [ui.inicio, ui.aviso, ui.decision, ui.resultado, ui.final]) c.hidden = c !== capa; }

  function pintarElegir() {
    ui.elegir.innerHTML = [2, 3, 4].map((n) =>
      `<button type="button" data-n="${n}" aria-pressed="${n === nJug}" aria-label="${n} jugadores">${n}` +
      `<span class="puntos">${JUGADORES.slice(0, n).map((j) => `<span style="background:${j.color}"></span>`).join("")}</span></button>`).join("");
  }
  const insignia = (p) => `<span class="jug" style="background:${JUGADORES[p].color}">${p + 1}</span>`;

  function irAlInicio() {
    fase = "inicio"; mapa = null; est = null; decisionActual = null;
    ui.hud.hidden = true; ui.panel.hidden = true;
    ranking.pintar(ui.rankingInicio, null);
    pintarElegir();
    mostrar(ui.inicio);
    ajustar();
  }

  function nuevaPartida() {
    est = generarDia();
    const gr = jugarGoodRoute(est);
    estGr = gr.e; estGr.ms = gr.ms;
    proximo = 0; reloj = 0; decisiones = []; decisionActual = null;
    fase = "aviso";
    ui.hud.hidden = false; ui.panel.hidden = false;
    ui.hudAyuda.textContent = "Atento a los imprevistos";
    actualizarHud();
    ajustar();
    ui.avisoTexto.innerHTML = `Empieza el día<small>3 técnicos · ${est.ordenes.length} órdenes · ${eventos.length} imprevistos, ${AJUSTES.imprevistosPorJugador} para cada uno</small>`;
    mostrar(ui.aviso);
    setTimeout(() => { if (fase === "aviso") { fase = "dia"; mostrar(null); } }, 1600);
  }

  /** Antes de cada imprevisto: avisa a quién le toca, para que tome el mouse. */
  function anunciarTurno() {
    const ev = eventos[proximo], j = JUGADORES[ev.jugador];
    reloj = ev.t;
    fase = "cambio";
    finCambio = performance.now() + AJUSTES.segundosCambio * 1000;
    ui.avisoTexto.innerHTML = `${insignia(ev.jugador)} Le toca a <span style="color:${j.color}">${j.nombre}</span>` +
      `<small>Toma el mouse: viene el imprevisto ${proximo + 1} de ${eventos.length}</small>`;
    mostrar(ui.aviso);
  }

  function abrirDecision() {
    const ev = eventos[proximo];
    reloj = ev.t; est.T = ev.t;
    const imp = construir(est, ev);
    const { evals, mejor, peor } = evaluar(est, imp);
    decisionActual = { ev, imp, evals, mejor, peor, inicio: performance.now() };
    fase = "decidir";
    ui.decHora.textContent = `Imprevisto ${proximo + 1} de ${eventos.length} · ${C.hhmm(ev.t)}`;
    ui.decQuien.innerHTML = `${insignia(ev.jugador)} Decide <b style="color:${JUGADORES[ev.jugador].color}">${JUGADORES[ev.jugador].nombre}</b>`;
    ui.decision.querySelector(".tarjeta-decision").style.borderColor = JUGADORES[ev.jugador].color;
    ui.decTitulo.textContent = imp.titulo;
    ui.decTexto.textContent = imp.texto;
    ui.opciones.innerHTML = imp.opciones.map((o, i) =>
      `<button class="opcion" data-i="${i}">${o.color ? `<span class="punto" style="background:${o.color}"></span>` : ""}${C.escapar(o.etiqueta)}</button>`).join("");
    mostrar(ui.decision);
  }

  function decidir(i, porTiempo = false) {
    if (fase !== "decidir") return;
    const d = decisionActual;
    const seg = (performance.now() - d.inicio) / 1000;
    d.imp.opciones[i].aplicar(est);
    const acierto = !porTiempo && !mejorQue(d.evals[d.mejor], d.evals[i]);
    const bono = acierto ? AJUSTES.bonoAcierto + Math.round(Math.max(0, AJUSTES.segundosDecision - seg) * AJUSTES.bonoRapidez) : 0;
    decisiones.push({
      jugador: d.ev.jugador, seg, porTiempo,
      hora: C.hhmm(d.ev.t), titulo: d.imp.titulo,
      tu: porTiempo ? "No alcanzaste a elegir" : d.imp.opciones[i].etiqueta,
      gr: d.imp.opciones[d.mejor].etiqueta, acierto, bono,
    });
    proximo++;
    decisionActual = null;
    fase = "dia";
    mostrar(null);
  }

  function terminarDia() {
    fase = "resultado";
    const tu = medirDia(est), gr = medirDia(estGr);
    const bonos = decisiones.reduce((s, d) => s + d.bono, 0);
    const puntos = Math.max(0, tu.ok * AJUSTES.puntosATiempo + tu.tarde * AJUSTES.puntosAtrasada - tu.pend * AJUSTES.castigoPendiente + bonos);
    puntosTotal = puntos;
    const aciertos = decisiones.filter((d) => d.acierto).length;
    ui.resTitulo.textContent = aciertos === decisiones.length ? "¡Decidieron como GoodRoute!" : `Acertaron ${aciertos} de ${decisiones.length}`;
    ui.rOkTu.textContent = tu.ok; ui.rOkGr.textContent = gr.ok;
    ui.rPeTu.textContent = tu.pend; ui.rPeGr.textContent = gr.pend;
    ui.rKmTu.textContent = C.km(tu.cuadras, AJUSTES.kmPorCuadra); ui.rKmGr.textContent = C.km(gr.cuadras, AJUSTES.kmPorCuadra);
    ui.decisiones.innerHTML = decisiones.map((d) => `<li>
      <span class="marca ${d.acierto ? "si" : "no"}">${d.acierto ? "✓" : "✗"}</span>
      <span>${insignia(d.jugador)} ${d.hora} · ${C.escapar(d.titulo)}<small>${JUGADORES[d.jugador].nombre}: ${C.escapar(d.tu)}${d.acierto ? "" : ` · GoodRoute: ${C.escapar(d.gr)}`}</small></span></li>`).join("");
    const salvo = (gr.ok - tu.ok);
    const calculo = estGr.ms < 1 ? "menos de 1 ms" : `${Math.round(estGr.ms)} ms`;
    ui.resDetalle.textContent =
      salvo > 0 ? `Con los mismos imprevistos, GoodRoute atendió ${salvo} ${salvo === 1 ? "orden" : "órdenes"} más a tiempo. Recalculó todo en ${calculo}.` :
      salvo < 0 ? `¡Terminaron con ${-salvo} ${salvo === -1 ? "orden" : "órdenes"} más a tiempo que GoodRoute! Sus decisiones rindieron más adelante. GoodRoute decidió cada imprevisto en ${calculo}, sin saber cuál venía después.` :
      `Llegaron al mismo resultado que GoodRoute, que recalculó todo en ${calculo}.`;
    ui.resPuntos.textContent = puntos;
    ui.hudAyuda.textContent = "Naranjo: el día de GoodRoute";
    mostrar(ui.resultado);
  }

  let registro = null;
  function terminarPartida() {
    fase = "final";
    ui.hud.hidden = true; ui.panel.hidden = true;
    ui.finPuntos.textContent = puntosTotal;
    const aciertos = decisiones.filter((d) => d.acierto).length;
    ui.finMensaje.textContent =
      aciertos === decisiones.length ? "Reaccionaron a todo como GoodRoute. Sangre fría de central de despacho." :
      aciertos > 0 ? `Acertaron ${aciertos} de ${decisiones.length} decisiones bajo presión.` :
      "Reprogramar con el reloj encima es difícil. Para eso está GoodRoute.";
    pintarAportes();
    registro = null; ui.form.hidden = false; ui.nombre.value = "";
    ranking.pintar(ui.rankingFinal, null);
    mostrar(ui.final);
  }

  /** Aporte de cada persona: sus decisiones, aciertos y puntos de bono. */
  function pintarAportes() {
    const js = JUGADORES.slice(0, nJug).map((_, p) => {
      const mias = decisiones.filter((d) => d.jugador === p);
      const elegidas = mias.filter((d) => !d.porTiempo);
      return {
        p, n: mias.length, aciertos: mias.filter((d) => d.acierto).length, bono: mias.reduce((s, d) => s + d.bono, 0),
        sinTiempo: mias.length - elegidas.length,
        seg: elegidas.length ? elegidas.reduce((s, d) => s + d.seg, 0) / elegidas.length : Infinity,
      };
    });
    const maxBono = Math.max(...js.map((j) => j.bono)), minSeg = Math.min(...js.map((j) => j.seg));
    ui.aportes.innerHTML = js.map((j) => {
      const ins = [];
      if (j.bono > 0 && j.bono === maxBono) ins.push("Mejor despachador");
      if (j.n && j.aciertos === j.n) ins.push("Todo como GoodRoute");
      if (j.seg < Infinity && j.seg === minSeg) ins.push("Más rápido");
      return `<div class="aporte">
        <span class="num" style="background:${JUGADORES[j.p].color}">${j.p + 1}</span>
        <span class="quien">${JUGADORES[j.p].nombre}${ins.map((s) => `<span class="insignia">${s}</span>`).join("")}</span>
        <span class="cifra">+${j.bono} pts</span>
        <small>${j.aciertos} de ${j.n} decisiones como GoodRoute${j.seg < Infinity ? ` · ${j.seg.toFixed(1).replace(".", ",")} s promedio` : ""}${j.sinTiempo ? ` · ${j.sinTiempo} sin elegir` : ""}</small>
      </div>`;
    }).join("");
  }

  ui.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (registro) return;
    registro = ranking.agregar(ui.nombre.value, puntosTotal);
    ui.form.hidden = true; ui.nombre.blur();
    ranking.pintar(ui.rankingFinal, registro);
  });

  // ---------- HUD y barras ----------
  function finDelDia(e) {
    let f = 0;
    for (const t of e.tecs) for (const v of t.visitas) if (v.estado === "plan") f = Math.max(f, v.fin);
    return f;
  }

  function actualizarHud() {
    if (!est) return;
    ui.hudReloj.textContent = C.hhmm(Math.min(reloj, L));
    ui.hudReloj.classList.toggle("urgente", fase === "decidir" || fase === "cambio");
    let hechas = 0;
    for (const t of est.tecs) for (const v of t.visitas) if (v.estado === "plan" && reloj >= v.fin) hechas++;
    ui.hudHechas.textContent = hechas;
    ui.hudPend.textContent = medirDia(est).pend;
    C.pintarBarras(ui.barras, est.tecs.map((t, i) => {
      const plan = t.visitas.filter((v) => v.estado === "plan");
      const fin = plan.length ? Math.max(...plan.map((v) => v.fin)) : 0;
      const pend = t.visitas.filter((v) => v.estado === "pendiente").length;
      return {
        nombre: NOMBRE[i], color: COLOR_T[i], hasta: fin, ahora: reloj,
        exceso: pend ? 1 : 0, apagado: !t.activo,
        texto: !t.activo ? "enfermo" : pend ? `${pend} no alcanza` : `${plan.length} · ${C.hhmm(fin)}`,
      };
    }), { limite: L });
  }

  // ---------- Dibujo ----------
  function ajustar() {
    vista.ajustarLienzo();
    if (!mapa) return;
    const arriba = ui.hud.hidden ? 0 : ui.hud.offsetHeight;
    const abajo = ui.panel.hidden ? 0 : ui.panel.offsetHeight;
    vista.encuadrar(mapa, { x: 0, y: arriba, w: innerWidth, h: innerHeight - arriba - abajo }, Math.min(40, innerWidth * 0.07));
  }

  function tramosDe(t) {
    const out = [];
    for (const v of t.visitas) {
      if (v.estado === "pendiente") continue;
      out.push({ tipo: "viaje", nodos: v.nodos, t0: v.salida, t1: v.llegada });
      if (v.estado === "plan") out.push({ tipo: "servicio", nodo: mapa ? est.ordenes[v.o].nodo : 0, t0: v.inicio, t1: v.fin });
    }
    return out;
  }

  function dibujar() {
    vista.limpiar();
    if (!mapa || !est) return;
    vista.ciudad();
    const c = vista.celda, ctx = vista.ctx;

    if (fase === "resultado") estGr.tecs.forEach((t) => vista.trazar(tramosDe(t), Infinity, C.COLOR.gr, Math.max(9, c * 0.14), 0.35));

    est.tecs.forEach((t, i) => {
      const tr = tramosDe(t);
      const hasta = t.enfermoEn != null ? Math.min(reloj, t.enfermoEn) : reloj;
      if (fase !== "resultado") vista.trazar(tr.filter((x) => x.t0 >= hasta || x.t1 > hasta), Infinity, COLOR_T[i], Math.max(3, c * 0.04), 0.25);
      vista.trazar(tr, hasta, COLOR_T[i], Math.max(4, c * 0.055), 0.9);
    });
    est.tecs.forEach((t, i) => vista.base(t.base, COLOR_T[i], NOMBRE[i][0]));

    // Órdenes
    const dueno = new Map();
    est.tecs.forEach((t, i) => t.visitas.forEach((v) => { if (v.estado !== "abortada") dueno.set(v.o, { i, v }); }));
    est.ordenes.forEach((o, id) => {
      const d = dueno.get(id);
      const sinAsig = est.sinAsignar.includes(id);
      let relleno = C.COLOR.blanco, borde = d ? COLOR_T[d.i] : C.COLOR.gris, texto = "", disc = false;
      if (d && d.v.estado === "plan" && reloj >= d.v.fin) {
        const tarde = o.limite != null && d.v.llegada > o.limite;
        relleno = tarde ? C.COLOR.tarde : COLOR_T[d.i]; borde = relleno; texto = tarde ? "!" : "✓";
      } else if ((d && d.v.estado === "pendiente") || sinAsig) {
        borde = C.COLOR.tarde; texto = "–"; disc = true;
      } else if (d && d.v.estado === "plan" && reloj >= d.v.inicio) {
        // en servicio: anillo de progreso
        const [x, y] = vista.px(o.nodo), r = Math.max(13, c * 0.2) + 6;
        const f = (reloj - d.v.inicio) / (d.v.fin - d.v.inicio);
        ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
        ctx.strokeStyle = COLOR_T[d.i]; ctx.lineWidth = 4; ctx.stroke();
      }
      vista.pin(o.nodo, { relleno, borde, texto, discontinuo: disc, radio: Math.max(11, c * 0.17) });
      if (o.urgente) vista.etiqueta(o.nodo, `⚡ ${C.hhmm(o.limite)}`, C.COLOR.tarde);
    });

    // Foco del imprevisto en curso (parpadea)
    if (fase === "decidir" && decisionActual?.imp.foco != null) {
      const [x, y] = vista.px(decisionActual.imp.foco);
      const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 120);
      ctx.beginPath(); ctx.arc(x, y, Math.max(18, c * 0.28) + pulso * 8, 0, Math.PI * 2);
      ctx.strokeStyle = C.COLOR.tarde; ctx.lineWidth = 4; ctx.stroke();
      if (decisionActual.ev.tipo === "urgente" && !est.ordenes.some((o) => o.nodo === decisionActual.imp.foco)) {
        vista.pin(decisionActual.imp.foco, { relleno: C.COLOR.tarde, borde: C.COLOR.tarde, texto: "⚡", radio: Math.max(11, c * 0.17) });
      }
    }

    est.tecs.forEach((t, i) => {
      const tt = t.enfermoEn != null ? Math.min(reloj, t.enfermoEn) : reloj;
      vista.furgon(vista.posicion(tramosDe(t), tt, t.base), COLOR_T[i], t.enfermoEn != null && reloj >= t.enfermoEn);
    });
  }

  // ---------- Entrada ----------
  ui.opciones.addEventListener("click", (e) => {
    const b = e.target.closest(".opcion");
    if (b) decidir(Number(b.dataset.i));
  });
  $("btn-jugar").addEventListener("click", nuevaPartida);
  $("btn-otra").addEventListener("click", irAlInicio);
  ui.elegir.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-n]");
    if (!b) return;
    nJug = Number(b.dataset.n);
    escribir(AJUSTES.claveJugadores, nJug);
    pintarElegir();
  });
  ui.btnSiguiente.addEventListener("click", terminarPartida);
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
    if (fase === "dia") {
      reloj += dt * AJUSTES.minutosPorSegundo;
      if (proximo < eventos.length && reloj >= eventos[proximo].t) anunciarTurno();
      else if (proximo >= eventos.length && (reloj >= finDelDia(est) || reloj >= L)) { reloj = Math.min(Math.max(reloj, finDelDia(est)), L); terminarDia(); }
      else if (proximo >= eventos.length) reloj += dt * AJUSTES.minutosPorSegundo;   // sin más imprevistos, el resto va más rápido
    } else if (fase === "cambio") {
      if (ahora >= finCambio) { mostrar(null); abrirDecision(); }
    } else if (fase === "decidir") {
      const quedan = AJUSTES.segundosDecision - (ahora - decisionActual.inicio) / 1000;
      ui.cuentaBarra.style.width = Math.max(0, (quedan / AJUSTES.segundosDecision) * 100) + "%";
      if (quedan <= 0) decidir(decisionActual.peor, true);
    }
    if (est && fase !== "inicio" && fase !== "final") actualizarHud();
    dibujar();
    requestAnimationFrame(cuadro);
  }

  window.__estadoJuego = () => ({ fase, est, estGr, eventos, proximo, reloj, decisionActual, decisiones, puntosTotal });

  irAlInicio();
  requestAnimationFrame(cuadro);
})();
