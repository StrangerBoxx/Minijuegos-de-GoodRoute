/* Ruta en Relevo — minijuego GRUPAL por turnos del stand (GoodRoute).
 *
 * Pensado para un stand con UN solo mouse: de 2 a 4 personas arman entre
 * todas una sola ruta y se pasan el mouse. En cada turno, una persona elige el
 * próximo cliente que visita la camioneta (tiene unos segundos).
 *
 * Cada elección se mide de verdad: con programación dinámica exacta (como
 * Held-Karp) se calcula la ruta más corta posible para lo que falta, antes y
 * después de elegir. La diferencia son las "cuadras de más" de esa jugada
 * (0 = la mejor elección posible). Así se ve cuánto aportó cada persona.
 * Al final, la ruta del equipo se compara con la del chip (el óptimo).
 *
 * Todo lo que conviene ajustar tras probar con gente está en AJUSTES.
 */
(() => {
  "use strict";
  const C = window.Comun;

  const AJUSTES = {
    clientesPorJugador: 3,      // 2 jugadores → 6 clientes, 4 → 12
    segundosTurno: 8,
    segundosCambio: 1.6,        // aviso "Turno de…" para pasar el mouse
    obras: 10,
    kmPorCuadra: 0.4,
    cuadrasPorSegundo: 7,       // velocidad de la camioneta al dibujar
    puntosJugada: 100,          // jugada perfecta…
    castigoCuadra: 25,          // …menos esto por cada cuadra de más
    bonoRapidez: 5,             // por segundo que sobró, solo en jugadas perfectas
    bonoRutaOptima: 300,        // si el equipo iguala al chip
    inactividadMs: 40000,
    claveRanking: "ruta-en-relevo.ranking",
    claveJugadores: "ruta-en-relevo.jugadores",
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
    hud: $("hud"), hudTurno: $("hud-turno"), hudAyuda: $("hud-ayuda"), hudCentro: $("hud-centro"),
    hudClientes: $("hud-clientes"), hudCuadras: $("hud-cuadras"), panel: $("panel-jugadores"),
    inicio: $("inicio"), elegir: $("elegir-jugadores"), aviso: $("aviso"), avisoTexto: $("aviso-texto"),
    final: $("final"), finTitulo: $("fin-titulo"), finDetalle: $("fin-detalle"), finPuntos: $("fin-puntos"),
    rCuTu: $("r-cu-tu"), rCuGr: $("r-cu-gr"), rKmTu: $("r-km-tu"), rKmGr: $("r-km-gr"),
    jugadas: $("jugadas"), aportes: $("aportes"),
    form: $("form-nombre"), nombre: $("nombre"), rankingInicio: $("ranking-inicio"), rankingFinal: $("ranking-final"),
  };
  const vista = new C.Vista($("mapa"));
  const ranking = new C.Ranking(AJUSTES.claveRanking);

  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  // ---------- Estado ----------
  let fase = "inicio";            // inicio | cambio | elegir | cierre | final
  let nJug = Math.min(4, Math.max(2, leer(AJUSTES.claveJugadores, 3)));
  let mapa = null, base = 0, clientes = [];
  let jugadas = [];               // { p, i (cliente), extra (cuadras de más), seg, auto, puntos }
  let restante = 0, finCambio = 0, hover = -1;
  let tAnim = 0;                  // segundos de animación de la camioneta
  let chip = null;                // { cuadras, orden, tramos }
  let G = null;                   // DP: G[mask * n + j] = cuadras mínimas para visitar mask partiendo en el cliente j

  const turno = () => jugadas.length;
  const jugadorDelTurno = () => turno() % nJug;
  const visitados = () => jugadas.map((j) => j.i);
  const restantes = () => { let m = (1 << clientes.length) - 1; for (const i of visitados()) m &= ~(1 << i); return m; };
  const posicionActual = () => (jugadas.length ? clientes[jugadas[jugadas.length - 1].i] : base);

  // ---------- Cálculo exacto ----------
  function prepararDP() {
    const n = clientes.length, N = 1 << n;
    const D = clientes.map((a) => clientes.map((b) => mapa.dist(a, b)));
    G = new Float64Array(N * n).fill(Infinity);
    for (let j = 0; j < n; j++) G[(1 << j) * n + j] = 0;
    for (let mask = 1; mask < N; mask++) {
      for (let j = 0; j < n; j++) {
        if (!(mask & (1 << j)) || mask === 1 << j) continue;
        const resto = mask ^ (1 << j);
        let mejor = Infinity;
        for (let k = 0; k < n; k++) if (resto & (1 << k)) mejor = Math.min(mejor, D[j][k] + G[resto * n + k]);
        G[mask * n + j] = mejor;
      }
    }
  }

  /** Cuadras mínimas para visitar todos los clientes de "mask" saliendo del nodo "desde". */
  function minimo(desde, mask) {
    if (!mask) return 0;
    const n = clientes.length;
    let mejor = Infinity;
    for (let j = 0; j < n; j++) if (mask & (1 << j)) mejor = Math.min(mejor, mapa.dist(desde, clientes[j]) + G[mask * n + j]);
    return mejor;
  }

  /** Cuadras de más de elegir el cliente i ahora (0 = la mejor elección posible). */
  function cuadrasDeMas(i) {
    const desde = posicionActual(), R = restantes();
    return mapa.dist(desde, clientes[i]) + minimo(clientes[i], R & ~(1 << i)) - minimo(desde, R);
  }

  function rutaDelChip() {
    const orden = [];
    let desde = base, R = (1 << clientes.length) - 1;
    while (R) {
      let mejor = -1, mv = Infinity;
      for (let j = 0; j < clientes.length; j++) {
        if (!(R & (1 << j))) continue;
        const v = mapa.dist(desde, clientes[j]) + minimo(clientes[j], R & ~(1 << j));
        if (v < mv) { mv = v; mejor = j; }
      }
      orden.push(mejor); R &= ~(1 << mejor); desde = clientes[mejor];
    }
    return orden;
  }

  const tramosDe = (orden) => C.tramosDeRuta(mapa, base, orden.map((i) => clientes[i]), {
    minutosPorCuadra: 1 / AJUSTES.cuadrasPorSegundo, servicios: orden.map(() => 0),
  }).tramos;
  const cuadrasDe = (orden) => { let n = base, s = 0; for (const i of orden) { s += mapa.dist(n, clientes[i]); n = clientes[i]; } return s; };

  // ---------- Flujo ----------
  function mostrar(capa) { for (const c of [ui.inicio, ui.aviso, ui.final]) c.hidden = c !== capa; }

  function pintarElegir() {
    ui.elegir.innerHTML = [2, 3, 4].map((n) =>
      `<button type="button" data-n="${n}" aria-pressed="${n === nJug}" aria-label="${n} jugadores">${n}` +
      `<span class="puntos">${JUGADORES.slice(0, n).map((j) => `<span style="background:${j.color}"></span>`).join("")}</span></button>`).join("");
  }

  function irAlInicio() {
    fase = "inicio"; mapa = null;
    ui.hud.hidden = true; ui.panel.hidden = true;
    ranking.pintar(ui.rankingInicio, null);
    pintarElegir();
    mostrar(ui.inicio);
    ajustar();
  }

  function nuevaPartida() {
    const v = C.vertical();
    mapa = C.crearCiudad({ cols: v ? 7 : 10, rows: v ? 9 : 7, obras: AJUSTES.obras });
    base = mapa.elegirBases(1)[0];
    clientes = mapa.elegirNodos(AJUSTES.clientesPorJugador * nJug, [base], 2);
    prepararDP();
    const orden = rutaDelChip();
    chip = { orden, cuadras: minimo(base, (1 << clientes.length) - 1), tramos: tramosDe(orden) };
    jugadas = []; tAnim = 0; hover = -1; firmaPanel = ""; fase = "cambio";
    ui.hud.hidden = false; ui.panel.hidden = false;
    actualizarHud();              // llena la barra de jugadores antes de medirla
    ajustar();
    empezarTurno(`Ruta en relevo<small>${clientes.length} clientes · ${AJUSTES.clientesPorJugador} turnos cada uno · ${AJUSTES.segundosTurno} s por turno</small>`, 2.6);
  }

  /** Aviso de cambio de turno: el mouse pasa a la siguiente persona. */
  function empezarTurno(encabezado = "", extra = 0) {
    const p = jugadorDelTurno(), ult = jugadas[jugadas.length - 1];
    let eco = "";
    if (ult) {
      eco = ult.auto ? `${JUGADORES[ult.p].nombre} no alcanzó a elegir`
        : ult.extra === 0 ? `✓ ${JUGADORES[ult.p].nombre} eligió el mejor cliente`
        : `${JUGADORES[ult.p].nombre}: ${ult.extra} ${ult.extra === 1 ? "cuadra" : "cuadras"} de más`;
      eco = `<span class="eco" style="color:${ult.auto || ult.extra ? C.COLOR.tarde : C.COLOR.acento}">${eco}</span>`;
    }
    fase = "cambio"; hover = -1;
    finCambio = performance.now() + (AJUSTES.segundosCambio + extra) * 1000;
    ui.avisoTexto.innerHTML = (encabezado ? `${encabezado}<br>` : "") +
      `<span class="turno-num" style="background:${color(p)}">${p + 1}</span>Turno de <span style="color:${color(p)}">${JUGADORES[p].nombre}</span>` +
      `<small>Toma el mouse y elige el próximo cliente</small>${eco}`;
    mostrar(ui.aviso);
    actualizarHud();
  }

  function elegirCliente(i, auto = false) {
    if (fase !== "elegir") return;
    const extra = cuadrasDeMas(i), seg = AJUSTES.segundosTurno - restante;
    const puntos = auto ? 0 : Math.max(0, AJUSTES.puntosJugada - AJUSTES.castigoCuadra * extra)
      + (extra === 0 ? Math.round(Math.max(0, restante) * AJUSTES.bonoRapidez) : 0);
    jugadas.push({ p: jugadorDelTurno(), i, extra, seg, auto, puntos });
    if (jugadas.length === clientes.length) cerrar();
    else empezarTurno();
  }

  /** Si se acaba el tiempo, la camioneta va al cliente más cercano y la jugada no suma. */
  function sinTiempo() {
    const desde = posicionActual(), R = restantes();
    let mejor = -1;
    clientes.forEach((n, i) => { if ((R & (1 << i)) && (mejor < 0 || mapa.dist(desde, n) < mapa.dist(desde, clientes[mejor]))) mejor = i; });
    elegirCliente(mejor, true);
  }

  function cerrar() {
    fase = "cierre";
    ui.hudAyuda.textContent = "La camioneta termina la ruta";
    actualizarHud();
    // espera a que la camioneta llegue al último cliente
  }

  let registro = null, puntosEquipo = 0;
  function mostrarFinal() {
    fase = "final";
    ui.panel.hidden = true;
    ui.hudAyuda.textContent = "Naranjo: la ruta del chip";
    const orden = visitados(), cu = cuadrasDe(orden), optima = cu <= chip.cuadras;
    const suma = jugadas.reduce((s, j) => s + j.puntos, 0);
    puntosEquipo = suma + (optima ? AJUSTES.bonoRutaOptima : 0);
    const dif = cu - chip.cuadras;
    ui.finTitulo.textContent = optima ? "¡Ruta perfecta! Igualaron al chip" : `El chip hizo ${dif} ${dif === 1 ? "cuadra" : "cuadras"} menos`;
    ui.rCuTu.textContent = cu; ui.rCuGr.textContent = chip.cuadras;
    ui.rKmTu.textContent = C.km(cu, AJUSTES.kmPorCuadra); ui.rKmGr.textContent = C.km(chip.cuadras, AJUSTES.kmPorCuadra);
    ui.jugadas.innerHTML = jugadas.map((j, k) =>
      `<span class="jugada${j.extra || j.auto ? " mala" : ""}" style="background:${color(j.p)}" title="Jugada ${k + 1}">${k + 1} ${j.auto ? "⏱" : j.extra ? "+" + j.extra : "✓"}</span>`).join("");
    const perfectas = jugadas.filter((j) => !j.auto && j.extra === 0).length;
    ui.finDetalle.textContent = optima
      ? `Las ${jugadas.length} elecciones llevaron a la ruta óptima. Bono de equipo: +${AJUSTES.bonoRutaOptima}.`
      : `${perfectas} de ${jugadas.length} elecciones fueron las mejores posibles. Cada "+n" son las cuadras de más que sumó esa jugada.`;
    pintarAportes();
    ui.finPuntos.textContent = puntosEquipo;
    registro = null; ui.form.hidden = false; ui.nombre.value = "";
    ranking.pintar(ui.rankingFinal, null);
    mostrar(ui.final);
  }

  function pintarAportes() {
    const js = JUGADORES.slice(0, nJug).map((_, p) => {
      const mias = jugadas.filter((j) => j.p === p);
      return {
        p, n: mias.length, puntos: mias.reduce((s, j) => s + j.puntos, 0),
        perfectas: mias.filter((j) => !j.auto && j.extra === 0).length,
        extra: mias.reduce((s, j) => s + j.extra, 0),
        seg: mias.filter((j) => !j.auto).reduce((s, j) => s + j.seg, 0) / Math.max(1, mias.filter((j) => !j.auto).length),
        auto: mias.filter((j) => j.auto).length,
      };
    });
    const maxPts = Math.max(...js.map((j) => j.puntos));
    const minSeg = Math.min(...js.filter((j) => j.n > j.auto).map((j) => j.seg));
    ui.aportes.innerHTML = js.map((j) => {
      const ins = [];
      if (j.puntos > 0 && j.puntos === maxPts) ins.push("Mejor navegante");
      if (j.n && j.perfectas === j.n) ins.push("Todo perfecto");
      if (j.n > j.auto && j.seg === minSeg) ins.push("Más rápido");
      return `<div class="aporte">
        <span class="num" style="background:${color(j.p)}">${j.p + 1}</span>
        <span class="quien">${JUGADORES[j.p].nombre}${ins.map((s) => `<span class="insignia">${s}</span>`).join("")}</span>
        <span class="cifra">${j.puntos} pts</span>
        <small>${j.perfectas} de ${j.n} perfectas · ${j.extra} ${j.extra === 1 ? "cuadra" : "cuadras"} de más${j.auto ? ` · ${j.auto} sin elegir` : ""}</small>
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

  // ---------- HUD ----------
  let firmaPanel = "";
  function actualizarHud() {
    if (!mapa) return;
    const p = jugadorDelTurno(), cerrado = fase !== "cambio" && fase !== "elegir";
    ui.hudTurno.innerHTML = cerrado ? "Ruta en Relevo" : `Turno de <span style="color:${color(p)}">${JUGADORES[p].nombre}</span>`;
    if (!cerrado) ui.hudAyuda.textContent = "Haz clic en el próximo cliente";
    ui.hudClientes.textContent = `${jugadas.length}/${clientes.length}`;
    ui.hudCuadras.textContent = cuadrasDe(visitados());
    const firma = `${cerrado ? -1 : p}|${jugadas.length}`;
    if (firma === firmaPanel) return;
    firmaPanel = firma;
    ui.panel.innerHTML = JUGADORES.slice(0, nJug).map((j, q) => {
      const mias = jugadas.filter((x) => x.p === q);
      const activa = !cerrado && q === p;
      return `<div class="ficha${activa ? " activa" : ""}" style="border-color:${j.color}">
        <span class="num" style="background:${j.color}">${q + 1}</span>
        <span><span class="nombre">${j.nombre}</span> ${activa ? `<span class="mouse" style="background:${j.color}">tiene el mouse</span>` : ""}<br>
        <span class="datos"><b>${mias.filter((x) => !x.auto && x.extra === 0).length}</b> ✓ de <b>${mias.length}</b> jugadas</span></span>
      </div>`;
    }).join("");
  }

  // ---------- Dibujo ----------
  function ajustar() {
    vista.ajustarLienzo();
    if (!mapa) return;
    const arriba = ui.hud.hidden ? 0 : ui.hud.offsetHeight;
    const abajo = ui.panel.hidden ? 0 : ui.panel.offsetHeight;
    vista.encuadrar(mapa, { x: 0, y: arriba, w: innerWidth, h: innerHeight - arriba - abajo }, Math.min(44, innerWidth * 0.07));
  }

  function dibujar() {
    vista.limpiar();
    if (!mapa) return;
    vista.ciudad();
    const ctx = vista.ctx, c = vista.celda, orden = visitados();
    if (fase === "final") vista.trazar(chip.tramos, Infinity, C.COLOR.gr, Math.max(10, c * 0.16), 0.45);

    // Ruta del equipo: cada tramo en el color de quien lo eligió.
    const tramos = tramosDe(orden);
    tramos.filter((t) => t.tipo === "viaje").forEach((t, k) =>
      vista.trazar([t], tAnim, color(jugadas[k].p), Math.max(5, c * 0.075), 0.9));
    vista.base(base);

    const p = jugadorDelTurno();
    clientes.forEach((nodo, i) => {
      const k = orden.indexOf(i);
      if (k >= 0) {
        const j = jugadas[k];
        vista.pin(nodo, { relleno: color(j.p), borde: j.extra || j.auto ? C.COLOR.tarde : color(j.p), texto: String(k + 1) });
      } else {
        const resaltado = fase === "elegir" && i === hover;
        if (resaltado) {
          const [x, y] = vista.px(nodo);
          ctx.beginPath(); ctx.arc(x, y, Math.max(14, c * 0.21) + 8, 0, Math.PI * 2);
          ctx.fillStyle = color(p) + "33"; ctx.fill();
        }
        vista.pin(nodo, { relleno: C.COLOR.blanco, borde: resaltado ? color(p) : C.COLOR.texto, radio: Math.max(14, c * 0.21) });
      }
      if (fase === "final") {   // número naranjo: orden del chip
        const [x, y] = vista.px(nodo), r = Math.max(13, c * 0.2), er = r * 0.55;
        ctx.beginPath(); ctx.arc(x + r * 0.95, y + r * 0.8, er, 0, Math.PI * 2); ctx.fillStyle = C.COLOR.gr; ctx.fill();
        ctx.fillStyle = C.COLOR.blanco; ctx.font = `700 ${er * 1.1}px "IBM Plex Sans", sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(chip.orden.indexOf(i) + 1), x + r * 0.95, y + r * 0.8 + 1);
      }
    });

    // Camioneta, con un halo del color de quien tiene el turno.
    const pos = vista.posicion(tramos, tAnim, base);
    if (fase === "elegir" || fase === "cambio") {
      ctx.beginPath(); ctx.arc(pos.x, pos.y, Math.max(24, c * 0.36) + 3 * Math.sin(performance.now() / 160), 0, Math.PI * 2);
      ctx.fillStyle = color(p) + "2a"; ctx.fill();
      ctx.strokeStyle = color(p); ctx.lineWidth = 3; ctx.stroke();
    }
    vista.furgon(pos, C.COLOR.base);     // negra: es de todo el equipo, no de un jugador
  }

  // ---------- Entrada (un solo mouse) ----------
  function clienteBajo(x, y) {
    const R = restantes();
    let mejor = -1, dm = Math.max(30, vista.celda * 0.45);
    clientes.forEach((n, i) => {
      if (!(R & (1 << i))) return;
      const [a, b] = vista.px(n), d = Math.hypot(a - x, b - y);
      if (d < dm) { dm = d; mejor = i; }
    });
    return mejor;
  }
  vista.canvas.addEventListener("pointermove", (e) => {
    hover = fase === "elegir" ? clienteBajo(e.clientX, e.clientY) : -1;
    vista.canvas.style.cursor = hover >= 0 ? "pointer" : "default";
  });
  vista.canvas.addEventListener("pointerdown", (e) => {
    if (fase === "cambio") { finCambio = 0; return; }     // un clic salta el aviso
    if (fase !== "elegir") return;
    const i = clienteBajo(e.clientX, e.clientY);
    if (i >= 0) elegirCliente(i);
  });
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
    if (mapa) {
      // La camioneta avanza hasta el último cliente elegido.
      const tramos = tramosDe(visitados());
      const meta = tramos.length ? tramos[tramos.length - 1].t1 : 0;
      tAnim = Math.min(meta, tAnim + dt);
      if (fase === "cambio" && ahora >= finCambio) {
        fase = "elegir"; restante = AJUSTES.segundosTurno; mostrar(null);
      } else if (fase === "elegir") {
        restante -= dt;
        const s = Math.max(0, Math.ceil(restante));
        ui.hudCentro.textContent = `0:${String(s).padStart(2, "0")}`;
        ui.hudCentro.classList.toggle("urgente", s <= 3);
        if (restante <= 0) sinTiempo();
      } else if (fase === "cambio") {
        ui.hudCentro.textContent = `0:${String(AJUSTES.segundosTurno).padStart(2, "0")}`;
        ui.hudCentro.classList.remove("urgente");
      } else if (fase === "cierre" && tAnim >= meta) {
        fase = "cierre-espera";
        setTimeout(() => { if (fase === "cierre-espera") mostrarFinal(); }, 500);
      }
      actualizarHud();
    }
    dibujar();
    requestAnimationFrame(cuadro);
  }

  window.__estadoJuego = () => ({ fase, nJug, jugadas, clientes, chip, vista, base, mapa, cuadrasDeMas, elegirCliente: (i) => elegirCliente(i) });

  irAlInicio();
  requestAnimationFrame(cuadro);
})();
