/* Duelo de Rutas — minijuego GRUPAL del stand de Control Position (GoodRoute).
 *
 * De 2 a 4 personas juegan a la vez en la misma pantalla, dividida en un
 * tablero por jugador. Todos tienen la misma ciudad y los mismos clientes, y
 * cada uno toca los clientes en el orden en que los visitaría (ruta abierta
 * desde la base). Los toques son independientes, así que se puede jugar al
 * mismo tiempo en una pantalla multitáctil.
 *
 * Gana la ruta con menos cuadras; terminar primero da un bono. El chip
 * (GoodRoute) calcula la ruta óptima exacta (Held-Karp) y al final de cada
 * ronda se ve en naranjo en todos los tableros: quien la iguala gana un extra.
 *
 * Se puede jugar de dos formas:
 * - En esta pantalla (táctil): cada tablero recibe los toques de su zona.
 * - Con celulares: cada persona escanea el QR de su color y juega en su
 *   teléfono (control.html). Esta pantalla muestra los tableros en vivo.
 *   La conexión está en online.js.
 *
 * Todo lo que conviene ajustar tras probar con gente está en AJUSTES.
 */
(() => {
  "use strict";
  const C = window.Comun;

  const AJUSTES = {
    kmPorCuadra: 0.4,
    rondas: [
      { clientes: 5, obras: 5, segundos: 25 },
      { clientes: 6, obras: 8, segundos: 30 },
      { clientes: 7, obras: 11, segundos: 35 },
    ],
    puntosEficiencia: 500,      // × (cuadras del chip / tus cuadras) × (visitados / total)
    bonoIgualar: 200,           // ruta tan corta como la del chip
    bonoRapidez: [150, 100, 50, 0],   // por orden de llegada, solo con la ruta completa
    separacion: 8,              // px entre tableros
    altoCabecera: 40,
    ciudadCelular: { cols: 5, rows: 7 },   // con celulares: vertical, como se sostiene el teléfono
    segundosAutoInicio: 3,      // con celulares: cuando están todos, empieza solo
    segundosResultadoOnline: 8, // con celulares: pasa sola a la siguiente ronda
    inactividadMs: 40000,
    claveRanking: "duelo-de-rutas.ranking",
    claveJugadores: "duelo-de-rutas.jugadores",
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
    hud: $("hud"), hudRonda: $("hud-ronda"), hudAyuda: $("hud-ayuda"), hudCentro: $("hud-centro"),
    hudClientes: $("hud-clientes"), hudChip: $("hud-chip"), tableros: $("tableros"),
    inicio: $("inicio"), elegir: $("elegir-jugadores"), aviso: $("aviso"), avisoTexto: $("aviso-texto"),
    resultado: $("resultado"), resTitulo: $("res-titulo"), resLista: $("res-lista"), resDetalle: $("res-detalle"),
    btnSiguiente: $("btn-siguiente"),
    final: $("final"), finTitulo: $("fin-titulo"), finLista: $("fin-lista"), finGrupo: $("fin-grupo"),
    form: $("form-nombres"), nombres: $("nombres"), rankingInicio: $("ranking-inicio"), rankingFinal: $("ranking-final"),
    sala: $("sala"), qrGrilla: $("qr-grilla"), btnEmpezar: $("btn-empezar"), salaCodigo: $("sala-codigo"),
    btnCelulares: $("btn-celulares"), modoNota: $("modo-nota"), hudCel: $("hud-cel"),
  };
  const O = window.Online;
  const canvas = $("mapa");
  const lienzo = new C.Vista(canvas);          // solo para limpiar y ajustar el canvas
  const ranking = new C.Ranking(AJUSTES.claveRanking);

  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  // ---------- Estado ----------
  let fase = "inicio";            // inicio | cuenta | jugar | resultado | final
  let nJug = Math.min(4, Math.max(2, leer(AJUSTES.claveJugadores, 2)));
  let rondaIdx = 0;
  let mapa = null, base = 0, clientes = [], chip = null;
  let paneles = [];               // por jugador: { rect, vista }
  let jug = [];                   // por jugador: { seq, cuadras, terminado, puntosRonda, total, igualadas, cuadrasTot, chipTot }
  let llegadas = [];              // jugadores en el orden en que completaron la ruta
  let restante = 0, tRonda = 0, finPendiente = null;
  // Con celulares
  let sala = null, conectados = {}, autoInicio = null, ultimaN = [], segPublicado = -1, nombresGuardados = new Set();

  const ronda = () => AJUSTES.rondas[rondaIdx];

  // ---------- Tableros ----------
  /** Divide la pantalla en n tableros lo más grandes y cuadrados posible. */
  function calcularPaneles() {
    const arriba = ui.hud.hidden ? 0 : ui.hud.offsetHeight;
    const area = { x: 0, y: arriba, w: innerWidth, h: innerHeight - arriba };
    const g = AJUSTES.separacion;
    const opciones = [];
    for (let cols = 1; cols <= nJug; cols++) {
      const filas = Math.ceil(nJug / cols);
      if (cols * filas - nJug >= cols) continue;
      const w = (area.w - g * (cols + 1)) / cols, h = (area.h - g * (filas + 1)) / filas;
      opciones.push({ cols, filas, w, h, valor: Math.min(w, h * 1.1) });
    }
    const o = opciones.sort((a, b) => b.valor - a.valor)[0];
    return Array.from({ length: nJug }, (_, p) => {
      const c = p % o.cols, f = Math.floor(p / o.cols);
      return { x: area.x + g + c * (o.w + g), y: area.y + g + f * (o.h + g), w: o.w, h: o.h };
    });
  }

  function ajustar() {
    lienzo.ajustarLienzo();
    if (!mapa) { ui.tableros.innerHTML = ""; return; }
    const rects = calcularPaneles();
    paneles = rects.map((rect, p) => {
      const vista = paneles[p]?.vista ?? new C.Vista(canvas);
      const cab = AJUSTES.altoCabecera;
      vista.encuadrar(mapa, { x: rect.x, y: rect.y + cab, w: rect.w, h: rect.h - cab }, Math.max(30, Math.min(44, rect.w * 0.09)));
      return { rect, vista };
    });
    pintarCabeceras();
  }

  function dimensionesCiudad() {
    if (sala) return AJUSTES.ciudadCelular;
    const r = calcularPaneles()[0], a = r.w / Math.max(1, r.h - AJUSTES.altoCabecera);
    return a > 1.25 ? { cols: 7, rows: 5 } : a < 0.8 ? { cols: 5, rows: 7 } : { cols: 6, rows: 6 };
  }

  // ---------- Reglas ----------
  const cuadrasDe = (seq) => {
    let n = base, s = 0;
    for (const i of seq) { s += mapa.dist(n, clientes[i]); n = clientes[i]; }
    return s;
  };

  function tramosDe(seq) {
    return C.tramosDeRuta(mapa, base, seq.map((i) => clientes[i]), { minutosPorCuadra: 1, servicios: seq.map(() => 0) }).tramos;
  }

  function puntuar(j, p) {
    const n = clientes.length, completa = j.seq.length === n;
    const ef = j.seq.length ? Math.min(1, chip.cuadras / Math.max(j.cuadras, 1)) * (j.seq.length / n) : 0;
    const iguala = completa && j.cuadras <= chip.cuadras;
    const lugar = llegadas.indexOf(p);
    const rapidez = completa && lugar >= 0 ? AJUSTES.bonoRapidez[lugar] ?? 0 : 0;
    return { puntos: Math.round(AJUSTES.puntosEficiencia * ef) + (iguala ? AJUSTES.bonoIgualar : 0) + rapidez, iguala, completa, lugar, rapidez };
  }

  // ---------- Flujo ----------
  function mostrar(capa) { for (const c of [ui.inicio, ui.sala, ui.aviso, ui.resultado, ui.final]) c.hidden = c !== capa; }

  function pintarElegir() {
    ui.elegir.innerHTML = [2, 3, 4].map((n) =>
      `<button type="button" data-n="${n}" aria-pressed="${n === nJug}" aria-label="${n} jugadores">${n}` +
      `<span class="puntos">${JUGADORES.slice(0, n).map((j) => `<span style="background:${j.color}"></span>`).join("")}</span></button>`).join("");
  }

  function irAlInicio() {
    fase = "inicio"; mapa = null; paneles = [];
    cerrarSala();
    ui.hud.hidden = true;
    const motivo = O.motivoNoDisponible();
    ui.btnCelulares.disabled = !!motivo;
    ui.modoNota.textContent = motivo ?? "";
    ranking.pintar(ui.rankingInicio, null);
    pintarElegir();
    mostrar(ui.inicio);
    ajustar();
  }

  // ---------- Con celulares ----------
  async function abrirSala() {
    if (!O.disponible()) return;
    fase = "sala"; conectados = {}; nombresGuardados = new Set();
    ui.btnEmpezar.disabled = true; ui.btnEmpezar.textContent = "Conectando…";
    ui.qrGrilla.innerHTML = ""; ui.salaCodigo.textContent = "";
    mostrar(ui.sala);
    try {
      sala = await O.crearSala("duelo-de-rutas", nJug);
      const actualizarQR = await O.pintarSala(ui.qrGrilla, sala, JUGADORES.slice(0, nJug));
      ui.salaCodigo.textContent = `Sala ${sala.codigo}`;
      sala.alJugadores((v) => { conectados = v; actualizarQR(v); revisarSala(); pintarCel(); });
      sala.alEntrada(recibir);
      revisarSala();
    } catch (e) {
      cerrarSala();
      irAlInicio();
      ui.modoNota.textContent = "No se pudo conectar: " + (e.message || e) + " Puedes jugar en esta pantalla.";
    }
  }

  const todosConectados = () => JUGADORES.slice(0, nJug).every((_, p) => conectados[p]);

  function revisarSala() {
    if (fase !== "sala") return;
    const n = Object.keys(conectados).length;
    clearTimeout(autoInicio);
    if (todosConectados()) {
      ui.btnEmpezar.disabled = false; ui.btnEmpezar.textContent = "¡Empezar!";
      autoInicio = setTimeout(() => { if (fase === "sala" && todosConectados()) nuevaPartida(); }, AJUSTES.segundosAutoInicio * 1000);
    } else {
      ui.btnEmpezar.disabled = true; ui.btnEmpezar.textContent = `Esperando jugadores… ${n} de ${nJug}`;
    }
  }

  function cerrarSala(vivoFinal) {
    clearTimeout(autoInicio);
    if (sala) sala.cerrar(vivoFinal);
    sala = null; conectados = {};
    ui.hudCel.hidden = true;
  }

  function pintarCel() {
    ui.hudCel.hidden = !sala || fase === "sala";
    ui.hudCel.innerHTML = "Celulares " + JUGADORES.slice(0, nJug).map((_, p) => `<i class="${conectados[p] ? "on" : ""}" style="${conectados[p] ? `background:${color(p)}` : ""}"></i>`).join("");
  }

  /** Jugada de un celular. */
  function recibir(j) {
    const p = Number(j.p);
    if (!(p >= 0 && p < nJug)) return;
    if (j.tipo === "tocar" && fase === "jugar") {
      if (j.n != null) ultimaN[p] = Math.max(ultimaN[p] ?? 0, j.n);
      tocarIndice(p, Number(j.i));
    } else if (j.tipo === "nombre" && fase === "final" && !nombresGuardados.has(p)) {
      nombresGuardados.add(p);
      ranking.agregar(String(j.nombre || ""), jug[p].total);
      ranking.pintar(ui.rankingFinal, null);
    }
  }

  function publicarRonda() {
    if (!sala) return;
    sala.publicar("ronda", {
      n: rondaIdx, total: AJUSTES.rondas.length, segundos: ronda().segundos,
      ciudad: C.datosCiudad(mapa), base, clientes,
    });
  }

  function vivo() {
    return {
      fase, ronda: rondaIdx, restante: Math.max(0, Math.ceil(restante)),
      jug: jug.map((j, p) => ({
        seq: j.seq, cuadras: j.cuadras, listo: j.terminado != null, lugar: llegadas.indexOf(p),
        n: ultimaN[p] ?? 0, total: j.total, igualadas: j.igualadas,
        ronda: fase === "resultado" && j.ultimo ? { puntos: j.ultimo.puntos, iguala: j.ultimo.iguala, completa: j.ultimo.completa } : null,
      })),
      chip: fase === "resultado" || fase === "final" ? { cuadras: chip.cuadras, orden: chip.orden } : null,
      podio: fase === "final" ? jug.map((j, p) => ({ p, total: j.total })).sort((a, b) => b.total - a.total || a.p - b.p).map((x) => x.p) : null,
    };
  }
  function publicarVivo() { if (sala) sala.publicar("vivo", vivo()); }

  function nuevaPartida() {
    clearTimeout(autoInicio);
    ultimaN = [];
    rondaIdx = 0;
    jug = Array.from({ length: nJug }, () => ({ seq: [], cuadras: 0, terminado: null, total: 0, igualadas: 0, cuadrasTot: 0, chipTot: 0, ultimo: null }));
    empezarRonda();
  }

  function empezarRonda() {
    const r = ronda();
    ui.hud.hidden = false;
    mapa = C.crearCiudad({ ...dimensionesCiudad(), obras: r.obras });
    base = mapa.elegirBases(1)[0];
    clientes = mapa.elegirNodos(r.clientes, [base], 2);
    const full = (1 << clientes.length) - 1, opt = C.rutasOptimas(mapa, base, clientes);
    const orden = opt.orden(full);
    chip = { cuadras: opt.costo[full], orden, tramos: tramosDe(orden) };
    for (const j of jug) { j.seq = []; j.cuadras = 0; j.terminado = null; j.ultimo = null; }
    llegadas = []; finPendiente = null;
    restante = r.segundos; tRonda = 0;
    fase = "cuenta";
    ui.hudRonda.textContent = `Ronda ${rondaIdx + 1} de ${AJUSTES.rondas.length}`;
    ui.hudAyuda.textContent = "Toca los clientes en orden, en tu tablero";
    ui.hudClientes.textContent = clientes.length;
    ui.hudChip.textContent = "?";
    ui.hudCentro.textContent = `0:${String(r.segundos).padStart(2, "0")}`;
    ui.hudCentro.classList.remove("urgente");
    ajustar();
    ui.avisoTexto.innerHTML = `Ronda ${rondaIdx + 1}<small>${clientes.length} clientes · ${r.segundos} s · la misma ciudad para todos</small>`;
    mostrar(ui.aviso);
    pintarCel();
    publicarRonda(); publicarVivo();
    setTimeout(() => { if (fase === "cuenta") { fase = "jugar"; mostrar(null); publicarVivo(); } }, sala ? 3000 : 1700);
  }

  function tocar(p, x, y) {
    const v = paneles[p].vista;
    const { indice, distancia } = v.cercano(clientes, x, y);
    if (indice < 0 || distancia > Math.max(26, v.celda * 0.45)) return;
    tocarIndice(p, indice);
  }

  /** Toca el cliente "indice" en el tablero del jugador p (desde la pantalla o desde su celular). */
  function tocarIndice(p, indice) {
    const j = jug[p];
    if (!j || !(indice >= 0 && indice < clientes.length)) return;
    const k = j.seq.indexOf(indice);
    if (k >= 0) j.seq = j.seq.slice(0, k);    // deshacer desde ese cliente
    else j.seq.push(indice);
    j.cuadras = cuadrasDe(j.seq);
    const completa = j.seq.length === clientes.length;
    if (completa && j.terminado == null) { j.terminado = tRonda; llegadas.push(p); }
    if (!completa && j.terminado != null) { j.terminado = null; llegadas = llegadas.filter((q) => q !== p); }
    pintarCabeceras();
    // Cuando todos completaron, la ronda termina sola (con un respiro para deshacer).
    if (llegadas.length === nJug) finPendiente = performance.now() + 900;
    else finPendiente = null;
    publicarVivo();
  }

  function terminarRonda() {
    if (fase !== "jugar") return;
    fase = "resultado"; finPendiente = null;
    const res = jug.map((j, p) => ({ p, ...puntuar(j, p) }));
    res.forEach((r) => {
      const j = jug[r.p];
      j.ultimo = r; j.total += r.puntos;
      if (r.iguala) j.igualadas++;
      if (r.completa) { j.cuadrasTot += j.cuadras; j.chipTot += chip.cuadras; }
    });
    const orden = res.slice().sort((a, b) => b.puntos - a.puntos || a.p - b.p);
    const iguales = res.filter((r) => r.iguala);
    ui.hudChip.textContent = chip.cuadras;
    ui.hudAyuda.textContent = "Naranjo: la ruta del chip";
    ui.resTitulo.textContent = iguales.length === nJug ? "¡Todos igualaron al chip!"
      : iguales.length ? `¡${JUGADORES[orden[0].p].nombre} gana la ronda!` : `Gana ${JUGADORES[orden[0].p].nombre}, pero el chip fue mejor`;
    ui.resLista.innerHTML = orden.map((r, k) => {
      const j = jug[r.p];
      const det = r.completa ? `${j.cuadras} cuadras${r.lugar >= 0 ? ` · ${r.lugar + 1}º en terminar` : ""}` : `${j.seq.length}/${clientes.length} clientes · ${j.cuadras} cuadras`;
      return `<li class="${k === 0 ? "primero" : ""}"><span class="pos">${k + 1}</span>
        <span class="num" style="background:${color(r.p)}">${r.p + 1}</span>
        <span class="quien">${JUGADORES[r.p].nombre}${r.iguala ? '<span class="marca-gr">= chip</span>' : ""}<small>${det}</small></span>
        <span class="pts">+${r.puntos}</span></li>`;
    }).join("");
    const completas = res.filter((r) => r.completa);
    const mejor = completas.length ? Math.min(...completas.map((r) => jug[r.p].cuadras)) : null;
    ui.resDetalle.textContent = `El chip hizo ${chip.cuadras} cuadras. ` + (iguales.length
      ? `Lo igualaron: ${iguales.map((r) => JUGADORES[r.p].nombre).join(", ")}.`
      : mejor != null ? `La mejor ruta del grupo quedó a ${mejor - chip.cuadras} ${mejor - chip.cuadras === 1 ? "cuadra" : "cuadras"}.` : "Nadie completó la ruta a tiempo.");
    ui.btnSiguiente.textContent = rondaIdx < AJUSTES.rondas.length - 1 ? "Siguiente ronda" : "Ver resultado";
    pintarCabeceras();
    mostrar(ui.resultado);
    publicarVivo();
    if (sala) {   // con celulares nadie toca esta pantalla: sigue sola
      const ronda0 = rondaIdx;
      setTimeout(() => { if (fase === "resultado" && rondaIdx === ronda0) siguiente(); }, AJUSTES.segundosResultadoOnline * 1000);
    }
  }

  function siguiente() {
    if (rondaIdx < AJUSTES.rondas.length - 1) { rondaIdx++; empezarRonda(); }
    else terminarPartida();
  }

  let guardado = false;
  function terminarPartida() {
    fase = "final"; mapa = null;
    ui.hud.hidden = true; ajustar();
    const orden = jug.map((j, p) => ({ p, j })).sort((a, b) => b.j.total - a.j.total || a.p - b.p);
    const empate = orden.length > 1 && orden[0].j.total === orden[1].j.total;
    ui.finTitulo.textContent = empate ? "¡Empate en el primer lugar!" : `¡Gana ${JUGADORES[orden[0].p].nombre}!`;
    const nRondas = AJUSTES.rondas.length;
    ui.finLista.innerHTML = orden.map(({ p, j }, k) => {
      const exceso = j.cuadrasTot - j.chipTot;
      const det = `${j.igualadas} de ${nRondas} rutas óptimas` + (j.chipTot ? ` · ${exceso === 0 ? "igual que el chip" : `${exceso} cuadras más que el chip`}` : "");
      return `<li class="${k === 0 ? "primero" : ""}"><span class="pos">${k + 1}</span>
        <span class="num" style="background:${color(p)}">${p + 1}</span>
        <span class="quien">${JUGADORES[p].nombre}<small>${det}</small></span>
        <span class="pts">${j.total}</span></li>`;
    }).join("");
    const igualadas = jug.reduce((s, j) => s + j.igualadas, 0), rutas = nJug * nRondas;
    ui.finGrupo.textContent = igualadas
      ? `Entre todos igualaron al chip ${igualadas} ${igualadas === 1 ? "vez" : "veces"} en ${rutas} rutas. Cada ruta óptima sumó para el grupo.`
      : `En ${rutas} rutas nadie igualó al chip. Encontrar la óptima a ojo es difícil; para eso está GoodRoute.`;
    guardado = false; ui.form.hidden = !!sala;   // con celulares, cada uno escribe su nombre en su teléfono
    publicarVivo();
    ui.nombres.innerHTML = orden.map(({ p, j }) =>
      `<label class="fila-nombre"><span class="num" style="background:${color(p)}">${p + 1}</span>
        <input data-p="${p}" maxlength="14" autocomplete="off" placeholder="Nombre de ${JUGADORES[p].nombre}" aria-label="Nombre de ${JUGADORES[p].nombre}" />
        <span class="pts">${j.total}</span></label>`).join("");
    ranking.pintar(ui.rankingFinal, null);
    mostrar(ui.final);
  }

  ui.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (guardado) return;
    const nuevos = [];
    for (const inp of ui.nombres.querySelectorAll("input")) {
      if (inp.value.trim()) nuevos.push(ranking.agregar(inp.value, jug[Number(inp.dataset.p)].total));
      inp.blur();
    }
    if (!nuevos.length) return;
    guardado = true; ui.form.hidden = true;
    pintarRankingResaltado(nuevos);
  });

  function pintarRankingResaltado(nuevos) {
    ranking.pintar(ui.rankingFinal, null);
    const ts = new Set(nuevos.map((r) => r.t));
    ranking.leer().forEach((r, k) => { if (ts.has(r.t)) ui.rankingFinal.querySelectorAll("li")[k]?.classList.add("tuyo"); });
  }

  // ---------- Dibujo ----------
  function pintarCabeceras() {
    if (!mapa) { ui.tableros.innerHTML = ""; return; }
    const n = clientes.length;
    ui.tableros.innerHTML = paneles.map(({ rect }, p) => {
      const j = jug[p];
      let estado;
      if (fase === "resultado" && j.ultimo) {
        estado = `<b>${j.cuadras}</b> cuadras · <b>+${j.ultimo.puntos}</b>${j.ultimo.iguala ? ' <span class="igual">= chip</span>' : ""}`;
      } else if (j.terminado != null) {
        estado = `<span class="listo">✓ Listo · ${llegadas.indexOf(p) + 1}º</span> · <b>${j.cuadras}</b> cuadras`;
      } else estado = `<b>${j.seq.length}/${n}</b> clientes · <b>${j.cuadras}</b> cuadras`;
      return `<div class="tablero-cab" style="left:${rect.x + 6}px;top:${rect.y + 6}px;max-width:${rect.w - 12}px;border-color:${color(p)}">
        <span class="num" style="background:${color(p)}">${p + 1}</span><span>${JUGADORES[p].nombre}</span><span>${estado}</span></div>`;
    }).join("");
  }

  function dibujarTablero(p) {
    const { rect, vista } = paneles[p], ctx = vista.ctx, j = jug[p], c = vista.celda;
    ctx.save();
    vista.redondeado(rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fillStyle = C.COLOR.calle; ctx.fill();
    ctx.clip();
    vista.ciudad();
    if (fase === "resultado") vista.trazar(chip.tramos, Infinity, C.COLOR.gr, Math.max(9, c * 0.15), 0.45);
    vista.trazar(tramosDe(j.seq), Infinity, color(p), Math.max(4, c * 0.07), 0.9);
    vista.base(base);
    clientes.forEach((nodo, i) => {
      const k = j.seq.indexOf(i);
      vista.pin(nodo, k >= 0
        ? { relleno: color(p), borde: color(p), texto: String(k + 1) }
        : { relleno: C.COLOR.blanco, borde: color(p) });
      if (fase === "resultado") {   // número naranjo: posición en la ruta del chip
        const [x, y] = vista.px(nodo), r = Math.max(13, c * 0.2), er = r * 0.55;
        ctx.beginPath(); ctx.arc(x + r * 0.95, y + r * 0.8, er, 0, Math.PI * 2); ctx.fillStyle = C.COLOR.gr; ctx.fill();
        ctx.fillStyle = C.COLOR.blanco; ctx.font = `700 ${er * 1.1}px "IBM Plex Sans", sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(chip.orden.indexOf(i) + 1), x + r * 0.95, y + r * 0.8 + 1);
      }
    });
    // Dónde va: anillo en el último cliente elegido (o en la base).
    const ult = j.seq.length ? clientes[j.seq[j.seq.length - 1]] : base;
    if (fase === "jugar" && j.terminado == null) {
      const [x, y] = vista.px(ult);
      ctx.beginPath(); ctx.arc(x, y, Math.max(20, c * 0.3) + 3 * Math.sin(performance.now() / 180), 0, Math.PI * 2);
      ctx.strokeStyle = color(p); ctx.globalAlpha = 0.45; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (j.terminado != null && fase === "jugar") {   // velo suave: ya terminó
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
    ctx.save();
    vista.redondeado(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, 14);
    ctx.strokeStyle = color(p); ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  function dibujar() {
    const ctx = lienzo.ctx;
    ctx.fillStyle = "#efe7e7"; ctx.fillRect(0, 0, innerWidth, innerHeight);
    if (!mapa) { lienzo.limpiar(); return; }
    paneles.forEach((_, p) => dibujarTablero(p));
  }

  // ---------- Entrada (cada tablero recibe sus propios toques) ----------
  canvas.addEventListener("pointerdown", (e) => {
    if (fase !== "jugar" || sala) return;     // con celulares, se juega en los teléfonos
    const p = paneles.findIndex(({ rect: r }) => e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h);
    if (p >= 0) tocar(p, e.clientX, e.clientY);
  });
  ui.elegir.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-n]");
    if (!b) return;
    nJug = Number(b.dataset.n);
    escribir(AJUSTES.claveJugadores, nJug);
    pintarElegir();
  });
  $("btn-jugar").addEventListener("click", nuevaPartida);
  ui.btnCelulares.addEventListener("click", abrirSala);
  ui.btnEmpezar.addEventListener("click", () => { if (fase === "sala" && todosConectados()) nuevaPartida(); });
  $("btn-sala-volver").addEventListener("click", irAlInicio);
  $("btn-otra").addEventListener("click", irAlInicio);
  ui.btnSiguiente.addEventListener("click", siguiente);
  addEventListener("resize", ajustar);

  C.modoStand({
    inactividadMs: AJUSTES.inactividadMs,
    enJuego: () => fase !== "inicio" && fase !== "sala",
    alInactivo: irAlInicio,
    ranking,
    alBorrar: () => ranking.pintar(ui.rankingInicio, null),
  });

  // ---------- Bucle ----------
  let anterior = performance.now();
  function cuadro(ahora) {
    const dt = Math.min((ahora - anterior) / 1000, 0.05);
    anterior = ahora;
    if (fase === "jugar") {
      tRonda += dt; restante -= dt;
      const s = Math.max(0, Math.ceil(restante));
      ui.hudCentro.textContent = `0:${String(s).padStart(2, "0")}`;
      ui.hudCentro.classList.toggle("urgente", s <= 5);
      if (s !== segPublicado) { segPublicado = s; publicarVivo(); }
      if (restante <= 0 || (finPendiente && ahora >= finPendiente)) terminarRonda();
    }
    dibujar();
    requestAnimationFrame(cuadro);
  }

  window.__estadoJuego = () => ({ fase, nJug, rondaIdx, jug, chip, clientes, paneles, llegadas, tocar, sala, conectados });

  irAlInicio();
  requestAnimationFrame(cuadro);
})();
