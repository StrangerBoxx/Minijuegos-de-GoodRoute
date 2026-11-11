/* Flota en Vivo — minijuego GRUPAL del stand de Control Position (GoodRoute).
 *
 * De 2 a 4 personas juegan a la vez en la misma pantalla. Cada una maneja una
 * camioneta (su color y su número). Durante el día van entrando órdenes con un
 * plazo para llegar; para tomar una, se arrastra desde la propia camioneta (o
 * desde la última orden de su cola) hasta la orden. La camioneta va sola por
 * el camino más corto. Se pueden arrastrar varias a la vez (multitáctil).
 *
 * Todo lo que se atiende suma al equipo y a quien lo atendió, así que al final
 * se ve el aporte de cada persona. El equipo se compara con un día paralelo en
 * que GoodRoute despachó las mismas órdenes con las mismas camionetas,
 * decidiendo cada vez con lo que había llegado hasta ese momento.
 *
 * Todo lo que conviene ajustar tras probar con gente está en AJUSTES.
 */
(() => {
  "use strict";
  const C = window.Comun;

  const AJUSTES = {
    finDia: 9 * 60,             // 8:00 → 17:00 (minutos)
    minutosPorSegundo: 8,       // velocidad del día: 540 min ≈ 68 s
    minutosPorCuadra: 6,
    minutosServicio: 25,
    kmPorCuadra: 0.4,
    ordenesPorJugador: 8,
    ultimaAparicion: 7 * 60,    // la última orden entra a las 15:00
    plazo: [110, 190],          // minutos para llegar desde que entra la orden
    plazoUrgente: [60, 90],
    fraccionUrgentes: 0.25,
    puntosATiempo: 100,
    puntosUrgente: 150,         // urgente atendida a tiempo
    puntosAtrasada: 40,
    bonoGoodRoute: 300,         // si el equipo iguala o supera a GoodRoute
    segundosCuenta: 3,
    inactividadMs: 40000,
    claveRanking: "flota-en-vivo.ranking",
    claveTotal: "flota-en-vivo.total",       // órdenes atendidas por todos los equipos del stand
    claveJugadores: "flota-en-vivo.jugadores",
  };

  const JUGADORES = [
    { nombre: "Azul", color: "#033E84" },
    { nombre: "Verde", color: "#27945c" },
    { nombre: "Morado", color: "#7c54c9" },
    { nombre: "Rosa", color: "#c23b7a" },
  ];
  const color = (p) => JUGADORES[p].color;

  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $("hud"), hudAyuda: $("hud-ayuda"), hudReloj: $("hud-reloj"), hudAtendidas: $("hud-atendidas"), hudEsperando: $("hud-esperando"),
    panel: $("panel-jugadores"), inicio: $("inicio"), elegir: $("elegir-jugadores"),
    aviso: $("aviso"), avisoTexto: $("aviso-texto"),
    final: $("final"), finTitulo: $("fin-titulo"), finDetalle: $("fin-detalle"), aportes: $("aportes"), finPuntos: $("fin-puntos"),
    rOkTu: $("r-ok-tu"), rOkGr: $("r-ok-gr"), rAtTu: $("r-at-tu"), rAtGr: $("r-at-gr"),
    rSinTu: $("r-sin-tu"), rSinGr: $("r-sin-gr"), rKmTu: $("r-km-tu"), rKmGr: $("r-km-gr"),
    form: $("form-nombre"), nombre: $("nombre"), rankingInicio: $("ranking-inicio"), rankingFinal: $("ranking-final"),
    totalStand: $("total-stand"),
  };
  const vista = new C.Vista($("mapa"));
  const ranking = new C.Ranking(AJUSTES.claveRanking);

  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  // ---------- Estado ----------
  let fase = "inicio";            // inicio | cuenta | jugar | cierre | final
  let nJug = Math.min(4, Math.max(2, leer(AJUSTES.claveJugadores, 3)));
  let mapa = null, bases = [], pedidos = [];
  let sim = null, simGr = null;   // el día del equipo y el de GoodRoute
  let reloj = 0, cuentaHasta = 0;
  const arrastres = new Map();    // pointerId → { p, x0, y0, x, y }
  let firmaPanel = "";

  // ---------- Simulación del día (la misma para el equipo y para GoodRoute) ----------
  function nuevaSim() {
    return {
      ordenes: pedidos.map((o) => ({ ...o, estado: "oculta", duenio: -1, llegada: null, asignadaEn: 0 })),
      vans: bases.map((b) => ({ nodo: b, cola: [], viaje: null, libreDesde: 0, cuadras: 0, tramos: [], tomadas: 0 })),
    };
  }

  function partir(s, v, t0) {
    const i = v.cola.shift(), o = s.ordenes[i];
    const ruta = mapa.camino(v.nodo, o.nodo);
    const t1 = t0 + (ruta.length - 1) * AJUSTES.minutosPorCuadra;
    v.viaje = { orden: i, ruta, t0, t1 };
    v.tramos.push({ tipo: "viaje", nodos: ruta, t0, t1 });
    o.estado = "encamino";
  }

  function llegar(s, v, p) {
    const { orden, ruta, t1 } = v.viaje, o = s.ordenes[orden];
    o.estado = "atendida"; o.llegada = t1; o.duenio = p;
    v.cuadras += ruta.length - 1; v.nodo = o.nodo;
    v.libreDesde = t1 + AJUSTES.minutosServicio;
    v.tramos.push({ tipo: "servicio", nodo: o.nodo, t0: t1, t1: v.libreDesde });
    v.viaje = null;
  }

  /** Avanza el día del equipo hasta el minuto t. */
  function avanzar(t) {
    for (const o of sim.ordenes) if (o.estado === "oculta" && t >= o.aparece) o.estado = "libre";
    sim.vans.forEach((v, p) => {
      if (v.viaje && t >= v.viaje.t1) llegar(sim, v, p);
      if (!v.viaje && t >= v.libreDesde && v.cola.length) {
        partir(sim, v, Math.max(v.libreDesde, sim.ordenes[v.cola[0]].asignadaEn));
      }
    });
  }

  /**
   * El día paralelo de GoodRoute: cada vez que una camioneta queda libre o
   * entra una orden, elige el par camioneta–orden más conveniente entre las
   * órdenes que ya llegaron (no sabe las que vienen).
   */
  function simularGoodRoute() {
    const s = nuevaSim(), mpc = AJUSTES.minutosPorCuadra;
    let t = 0;
    for (let guarda = 0; guarda < 10000; guarda++) {
      for (const o of s.ordenes) if (o.estado === "oculta" && o.aparece <= t) o.estado = "libre";
      s.vans.forEach((v, p) => { if (v.viaje && v.viaje.t1 <= t) llegar(s, v, p); });
      for (;;) {
        let mejor = null;
        for (const v of s.vans) {
          if (v.viaje || v.libreDesde > t) continue;
          s.ordenes.forEach((o, i) => {
            if (o.estado !== "libre") return;
            const viaje = mapa.dist(v.nodo, o.nodo) * mpc, llegada = t + viaje;
            const clave = llegada <= o.plazo
              ? viaje + 0.3 * (o.plazo - llegada) - (o.urgente ? 20 : 0)   // cerca y con poco margen primero
              : 10000 + viaje;                                             // atrasada: solo si no hay otra
            if (!mejor || clave < mejor.clave) mejor = { clave, v, i };
          });
        }
        if (!mejor) break;
        mejor.v.cola.push(mejor.i);
        partir(s, mejor.v, t);
      }
      let prox = Infinity;
      for (const v of s.vans) prox = Math.min(prox, v.viaje ? v.viaje.t1 : v.libreDesde > t ? v.libreDesde : Infinity);
      for (const o of s.ordenes) if (o.estado === "oculta") prox = Math.min(prox, o.aparece);
      if (prox > AJUSTES.finDia) break;
      t = prox;
    }
    return s;
  }

  const puntosDe = (o) => o.llegada <= o.plazo ? (o.urgente ? AJUSTES.puntosUrgente : AJUSTES.puntosATiempo) : AJUSTES.puntosAtrasada;

  function resumen(s) {
    const porJug = s.vans.map((v) => ({ atendidas: 0, aTiempo: 0, atrasadas: 0, urgentes: 0, puntos: 0, cuadras: v.cuadras, tomadas: v.tomadas }));
    for (const o of s.ordenes) {
      if (o.estado !== "atendida") continue;
      const j = porJug[o.duenio], ok = o.llegada <= o.plazo;
      j.atendidas++; j.puntos += puntosDe(o);
      if (ok) j.aTiempo++; else j.atrasadas++;
      if (ok && o.urgente) j.urgentes++;
    }
    const suma = (k) => porJug.reduce((a, j) => a + j[k], 0);
    return {
      porJug, atendidas: suma("atendidas"), aTiempo: suma("aTiempo"), atrasadas: suma("atrasadas"),
      puntos: suma("puntos"), cuadras: suma("cuadras"), sinAtender: s.ordenes.length - suma("atendidas"),
    };
  }

  // ---------- Flujo ----------
  function mostrar(capa) { for (const c of [ui.inicio, ui.aviso, ui.final]) c.hidden = c !== capa; }

  function pintarElegir() {
    ui.elegir.innerHTML = [2, 3, 4].map((n) =>
      `<button type="button" data-n="${n}" aria-pressed="${n === nJug}" aria-label="${n} jugadores">${n}` +
      `<span class="puntos">${JUGADORES.slice(0, n).map((j) => `<span style="background:${j.color}"></span>`).join("")}</span></button>`).join("");
  }

  function irAlInicio() {
    fase = "inicio"; mapa = null; sim = null; arrastres.clear();
    ui.hud.hidden = true; ui.panel.hidden = true;
    ranking.pintar(ui.rankingInicio, null);
    pintarElegir();
    mostrar(ui.inicio);
    ajustar();
  }

  function generarPedidos() {
    const total = AJUSTES.ordenesPorJugador * nJug;
    const nodos = C.barajar(mapa.elegirNodos(total, bases, 1));
    const rango = ([a, b]) => a + Math.random() * (b - a);
    const tiempos = nodos.map((_, i) => (i < nJug ? 0 : Math.random() * AJUSTES.ultimaAparicion)).sort((a, b) => a - b);
    return nodos.map((nodo, i) => {
      const urgente = i >= nJug && Math.random() < AJUSTES.fraccionUrgentes;
      const aparece = tiempos[i];
      return { nodo, aparece, urgente, plazo: aparece + rango(urgente ? AJUSTES.plazoUrgente : AJUSTES.plazo) };
    });
  }

  function nuevaPartida() {
    const v = C.vertical();
    mapa = C.crearCiudad({ cols: v ? 7 : 10, rows: v ? 9 : 7, obras: 10 });
    bases = mapa.elegirBases(nJug);
    pedidos = generarPedidos();
    simGr = simularGoodRoute();
    sim = nuevaSim();
    reloj = 0; arrastres.clear(); firmaPanel = "";
    avanzar(0);
    fase = "cuenta";
    cuentaHasta = performance.now() + AJUSTES.segundosCuenta * 1000;
    ui.hud.hidden = false; ui.panel.hidden = false;
    ui.hudReloj.textContent = C.hhmm(0);
    ui.hudAyuda.textContent = "Arrastra desde tu camioneta hasta una orden";
    actualizarPanel();
    ajustar();
    const quienes = JUGADORES.slice(0, nJug).map((j, p) => `<span style="color:${j.color}">${p + 1} ${j.nombre}</span>`).join(" · ");
    ui.avisoTexto.innerHTML = `Busquen su camioneta<small>${quienes}<br>Ya pueden tomar las primeras órdenes</small>`;
    mostrar(ui.aviso);
  }

  function asignar(i, p) {
    const o = sim.ordenes[i];
    if (o.estado === "asignada") {
      const cola = sim.vans[o.duenio].cola, k = cola.indexOf(i);
      if (k >= 0) cola.splice(k, 1);
    }
    o.estado = "asignada"; o.duenio = p; o.asignadaEn = reloj;
    sim.vans[p].cola.push(i);
    sim.vans[p].tomadas++;
  }

  function cerrarDia() {
    fase = "cierre"; arrastres.clear();
    ui.avisoTexto.innerHTML = `17:00<small>Terminó el día</small>`;
    mostrar(ui.aviso);
    setTimeout(() => { if (fase === "cierre") mostrarFinal(); }, 1600);
  }

  let registro = null, puntosEquipo = 0;
  function mostrarFinal() {
    fase = "final";
    ui.hud.hidden = true; ui.panel.hidden = true;
    const tu = resumen(sim), gr = resumen(simGr);
    const gana = tu.puntos >= gr.puntos;
    puntosEquipo = tu.puntos + (gana ? AJUSTES.bonoGoodRoute : 0);

    ui.finTitulo.textContent = tu.puntos > gr.puntos ? "¡Le ganaron a GoodRoute!" : gana ? "¡Empataron con GoodRoute!" : "GoodRoute despachó mejor";
    ui.rOkTu.textContent = tu.aTiempo; ui.rOkGr.textContent = gr.aTiempo;
    ui.rAtTu.textContent = tu.atrasadas; ui.rAtGr.textContent = gr.atrasadas;
    ui.rSinTu.textContent = tu.sinAtender; ui.rSinGr.textContent = gr.sinAtender;
    ui.rKmTu.textContent = C.km(tu.cuadras, AJUSTES.kmPorCuadra); ui.rKmGr.textContent = C.km(gr.cuadras, AJUSTES.kmPorCuadra);
    const dif = gr.aTiempo - tu.aTiempo;
    ui.finDetalle.textContent = gana
      ? `Coordinaron como un despacho profesional. GoodRoute decide cada orden apenas entra, sin saber las que vienen. Bono de equipo: +${AJUSTES.bonoGoodRoute}.`
      : `GoodRoute llegó a tiempo a ${dif > 0 ? `${dif} ${dif === 1 ? "orden" : "órdenes"} más` : "las urgentes que valían más"}, decidiendo cada orden apenas entraba, sin saber las que venían.`;

    pintarAportes(tu);
    ui.finPuntos.textContent = puntosEquipo;

    // Lo que suma este equipo al total del stand.
    const total = leer(AJUSTES.claveTotal, 0) + tu.atendidas;
    escribir(AJUSTES.claveTotal, total);
    ui.totalStand.textContent = `Ustedes atendieron ${tu.atendidas}. Entre todos los equipos del stand ya van ${total} órdenes atendidas.`;

    registro = null; ui.form.hidden = false; ui.nombre.value = "";
    ranking.pintar(ui.rankingFinal, null);
    mostrar(ui.final);
  }

  /** Aporte de cada persona: órdenes, puntos, porcentaje del equipo e insignias. */
  function pintarAportes(tu) {
    const js = tu.porJug;
    const max = (f) => Math.max(...js.map(f));
    const conKm = js.filter((j) => j.atendidas > 0).map((j) => j.cuadras / j.atendidas);
    const minKm = conKm.length ? Math.min(...conKm) : null;
    ui.aportes.innerHTML = js.map((j, p) => {
      const ins = [];
      if (j.atendidas > 0 && j.atendidas === max((x) => x.atendidas)) ins.push("Más órdenes");
      if (j.urgentes > 0 && j.urgentes === max((x) => x.urgentes)) ins.push("Rescató urgentes");
      if (j.atendidas >= 2 && minKm != null && j.cuadras / j.atendidas === minKm) ins.push("Menos km por orden");
      if (j.atendidas > 0 && j.atrasadas === 0) ins.push("Todo a tiempo");
      const pct = tu.puntos ? Math.round((j.puntos / tu.puntos) * 100) : 0;
      return `<div class="aporte">
        <span class="num" style="background:${color(p)}">${p + 1}</span>
        <span class="quien">${C.escapar(JUGADORES[p].nombre)}${ins.map((s) => `<span class="insignia">${s}</span>`).join("")}</span>
        <span class="cifra">${j.puntos} pts<small>${pct}% del equipo</small></span>
        <span class="barra"><span class="barra-relleno" style="width:${pct}%;background:${color(p)}"></span></span>
        <small style="grid-column:2 / 4">${j.atendidas} atendidas · ${j.aTiempo} a tiempo · ${C.km(j.cuadras, AJUSTES.kmPorCuadra)} km</small>
      </div>`;
    }).join("");
  }

  ui.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (registro) return;
    registro = ranking.agregar(ui.nombre.value, puntosEquipo);
    ui.form.hidden = true; ui.nombre.blur();
    ranking.pintar(ui.rankingFinal, registro);
  });

  function actualizarPanel() {
    if (!sim) return;
    const datos = sim.vans.map((v, p) => {
      const hechas = sim.ordenes.filter((o) => o.estado === "atendida" && o.duenio === p).length;
      return [hechas, v.cola.length + (v.viaje ? 1 : 0)];
    });
    const firma = JSON.stringify(datos);
    if (firma === firmaPanel) return;
    firmaPanel = firma;
    ui.panel.innerHTML = datos.map(([hechas, cola], p) =>
      `<div class="ficha" style="border-color:${color(p)}">
        <span class="num" style="background:${color(p)}">${p + 1}</span>
        <span><span class="nombre">${JUGADORES[p].nombre}</span><br>
        <span class="datos"><b>${hechas}</b> atendidas · <b>${cola}</b> en cola</span></span>
      </div>`).join("");
    ui.hudAtendidas.textContent = sim.ordenes.filter((o) => o.estado === "atendida").length;
    ui.hudEsperando.textContent = sim.ordenes.filter((o) => o.estado === "libre").length;
  }

  // ---------- Dibujo ----------
  function ajustar() {
    vista.ajustarLienzo();
    if (!mapa) return;
    const arriba = ui.hud.hidden ? 0 : ui.hud.offsetHeight;
    const abajo = ui.panel.hidden ? 0 : ui.panel.offsetHeight;
    vista.encuadrar(mapa, { x: 0, y: arriba, w: innerWidth, h: innerHeight - arriba - abajo }, Math.min(44, innerWidth * 0.07));
  }

  const radioPin = () => Math.max(14, vista.celda * 0.21);
  const radioToque = () => Math.max(34, vista.celda * 0.5);
  const posVan = (v, p) => vista.posicion(v.tramos, reloj, bases[p]);

  function polilinea(nodos) {
    const ctx = vista.ctx;
    nodos.forEach((n, k) => { const [x, y] = vista.px(n); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  }

  /** Lo que le falta a cada camioneta: el viaje en curso y su cola, punteado. */
  function dibujarPlan(v, p) {
    const ctx = vista.ctx;
    ctx.save();
    ctx.strokeStyle = color(p); ctx.lineWidth = Math.max(3, vista.celda * 0.045); ctx.globalAlpha = 0.55;
    ctx.setLineDash([7, 7]); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    let desde = v.nodo;
    if (v.viaje) { const q = posVan(v, p); ctx.moveTo(q.x, q.y); polilinea(v.viaje.ruta.slice(1)); desde = sim.ordenes[v.viaje.orden].nodo; }
    for (const i of v.cola) { polilinea(mapa.camino(desde, sim.ordenes[i].nodo)); desde = sim.ordenes[i].nodo; }
    ctx.stroke();
    ctx.restore();
  }

  function dibujarOrden(o, i) {
    if (o.estado === "oculta") return;
    const ctx = vista.ctx, t = reloj, r0 = radioPin();
    if (o.estado === "atendida") {
      const edad = t - o.llegada;
      if (edad > 50) return;
      ctx.save(); ctx.globalAlpha = Math.max(0.15, 1 - edad / 50);
      vista.pin(o.nodo, { relleno: color(o.duenio), borde: color(o.duenio), texto: "✓", radio: r0 * 0.8 });
      ctx.restore();
      return;
    }
    const r = r0 * Math.min(1, 0.45 + (t - o.aparece) / 8);   // entra creciendo
    const tarde = t > o.plazo;
    const f = Math.max(0, Math.min(1, (o.plazo - t) / (o.plazo - o.aparece)));
    const [x, y] = vista.px(o.nodo);
    // Anillo del plazo: se va vaciando hasta la hora límite.
    if (!tarde) {
      ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(28,26,27,.08)"; ctx.lineWidth = 5; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      ctx.strokeStyle = f < 0.3 ? C.COLOR.tarde : o.urgente ? C.COLOR.aviso : "#6b6860"; ctx.lineWidth = 5; ctx.stroke();
    }
    const tomada = o.estado === "asignada" || o.estado === "encamino";
    const borde = tomada ? color(o.duenio) : tarde ? C.COLOR.tarde : o.urgente ? C.COLOR.aviso : C.COLOR.texto;
    let texto = o.urgente ? "⚡" : "";
    if (tarde && !tomada) texto = "!";
    if (o.estado === "asignada") texto = String(sim.vans[o.duenio].cola.indexOf(i) + 1 + (sim.vans[o.duenio].viaje ? 1 : 0));
    vista.pin(o.nodo, {
      relleno: o.estado === "encamino" ? color(o.duenio) : C.COLOR.blanco,
      borde, texto, radio: r, discontinuo: tarde && !tomada,
      tinta: o.estado === "encamino" ? C.COLOR.blanco : tarde && !tomada ? C.COLOR.tarde : borde,
    });
    if (o.estado === "libre" && f < 0.3 && !tarde) {             // aviso que parpadea cuando queda poco
      ctx.save(); ctx.globalAlpha = 0.25 + 0.25 * Math.sin(performance.now() / 120);
      ctx.beginPath(); ctx.arc(x, y, r + 12, 0, Math.PI * 2); ctx.strokeStyle = C.COLOR.tarde; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
  }

  function dibujar() {
    vista.limpiar();
    if (!mapa || !sim) return;
    vista.ciudad();
    const ctx = vista.ctx, c = vista.celda;
    sim.vans.forEach((v, p) => vista.trazar(v.tramos, reloj, color(p), Math.max(4, c * 0.06), 0.3));
    sim.vans.forEach(dibujarPlan);
    bases.forEach((b, p) => vista.base(b, color(p), String(p + 1)));
    sim.ordenes.forEach(dibujarOrden);
    sim.vans.forEach((v, p) => {
      const q = posVan(v, p);
      // Halo para encontrar la propia camioneta.
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(22, c * 0.32), 0, Math.PI * 2);
      ctx.fillStyle = color(p) + "22"; ctx.fill();
      vista.furgon(q, color(p));
      ctx.fillStyle = C.COLOR.blanco; ctx.font = `700 ${Math.max(11, c * 0.15)}px "IBM Plex Sans", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(p + 1), q.x, q.y + 1);
    });
    // Arrastres en curso: una banda elástica por dedo.
    for (const a of arrastres.values()) {
      ctx.save();
      ctx.strokeStyle = color(a.p); ctx.lineWidth = Math.max(4, c * 0.07); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(a.x0, a.y0); ctx.lineTo(a.x, a.y); ctx.stroke();
      const destino = ordenBajo(a.x, a.y, a.p);
      ctx.beginPath();
      if (destino >= 0) { const [x, y] = vista.px(sim.ordenes[destino].nodo); ctx.arc(x, y, radioPin() + 10, 0, Math.PI * 2); ctx.lineWidth = 4; }
      else ctx.arc(a.x, a.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- Entrada (multitáctil: cada dedo arrastra por su cuenta) ----------
  /** Camioneta que se agarra en (x, y): la propia camioneta o la última orden de su cola. */
  function agarrar(x, y) {
    let mejor = null;
    sim.vans.forEach((v, p) => {
      const puntos = [posVan(v, p)];
      if (v.cola.length) { const [a, b] = vista.px(sim.ordenes[v.cola[v.cola.length - 1]].nodo); puntos.push({ x: a, y: b }); }
      else if (v.viaje) { const [a, b] = vista.px(sim.ordenes[v.viaje.orden].nodo); puntos.push({ x: a, y: b }); }
      for (const q of puntos) {
        const d = Math.hypot(q.x - x, q.y - y);
        if (d < radioToque() && (!mejor || d < mejor.d)) mejor = { d, p, x0: q.x, y0: q.y };
      }
    });
    return mejor;
  }

  /** Orden que se puede tomar bajo (x, y): libre o en la cola de otro (todavía no sale hacia ella). */
  function ordenBajo(x, y, p) {
    let mejor = -1, dm = radioToque();
    sim.ordenes.forEach((o, i) => {
      if (!(o.estado === "libre" || (o.estado === "asignada" && o.duenio !== p))) return;
      const [a, b] = vista.px(o.nodo), d = Math.hypot(a - x, b - y);
      if (d < dm) { dm = d; mejor = i; }
    });
    return mejor;
  }

  const jugable = () => fase === "jugar" || fase === "cuenta";
  vista.canvas.addEventListener("pointerdown", (e) => {
    if (!jugable()) return;
    const g = agarrar(e.clientX, e.clientY);
    if (!g) return;
    arrastres.set(e.pointerId, { p: g.p, x0: g.x0, y0: g.y0, x: e.clientX, y: e.clientY });
    try { vista.canvas.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
  });
  vista.canvas.addEventListener("pointermove", (e) => {
    const a = arrastres.get(e.pointerId);
    if (a) { a.x = e.clientX; a.y = e.clientY; }
  });
  vista.canvas.addEventListener("pointerup", (e) => {
    const a = arrastres.get(e.pointerId);
    if (!a) return;
    arrastres.delete(e.pointerId);
    if (!jugable()) return;
    const i = ordenBajo(e.clientX, e.clientY, a.p);
    if (i >= 0) { asignar(i, a.p); actualizarPanel(); }
  });
  vista.canvas.addEventListener("pointercancel", (e) => arrastres.delete(e.pointerId));

  ui.elegir.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-n]");
    if (!b) return;
    nJug = Number(b.dataset.n);
    escribir(AJUSTES.claveJugadores, nJug);
    pintarElegir();
  });
  $("btn-jugar").addEventListener("click", nuevaPartida);
  $("btn-otra").addEventListener("click", irAlInicio);
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
    if (fase === "cuenta") {
      const s = Math.ceil((cuentaHasta - ahora) / 1000);
      if (s <= 0) { fase = "jugar"; mostrar(null); }
      else ui.hudReloj.textContent = `${s}…`;
    } else if (fase === "jugar") {
      reloj = Math.min(AJUSTES.finDia, reloj + dt * AJUSTES.minutosPorSegundo);
      avanzar(reloj);
      ui.hudReloj.textContent = C.hhmm(reloj);
      ui.hudReloj.classList.toggle("urgente", AJUSTES.finDia - reloj < 60);
      if (reloj >= AJUSTES.finDia) cerrarDia();
    }
    actualizarPanel();
    dibujar();
    requestAnimationFrame(cuadro);
  }

  window.__estadoJuego = () => ({ fase, nJug, sim, simGr, reloj, vista, bases, resumen, asignar, avanzar });

  irAlInicio();
  requestAnimationFrame(cuadro);
})();
