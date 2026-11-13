/* Ruta a Mano (antes "Gánale al Chip · A pulso") — minijuego del stand de Control Position (GoodRoute).
 *
 * Versión de "Gánale al Chip" en que el jugador maneja: arrastra la camioneta
 * por las calles con el mouse o el dedo hasta visitar a todos los clientes.
 * Si toca el borde de una manzana, una obra o se sale del mapa, choca y
 * vuelve a empezar desde la base (los clientes visitados se borran), mientras
 * el reloj sigue corriendo.
 *
 * El chip recorre al mismo tiempo la ruta óptima (Held-Karp exacto, ruta
 * abierta) y nunca choca. Gana quien visite a todos primero. El jugador
 * decide el orden y además tiene que manejar bien; el chip solo planifica.
 *
 * Todo lo que conviene ajustar tras probar con gente está en AJUSTES.
 */
(() => {
  "use strict";
  const C = window.Comun;

  const AJUSTES = {
    anchoCalle: 0.38,           // ancho de la calle por defecto (cada nivel trae el suyo: más angosta = más difícil)
    radioCliente: 0.22,         // a qué distancia del cliente (en cuadras) cuenta como visitado
    largoObra: 0.14,            // media longitud de la obra a lo largo de la calle (en cuadras)
    alChocar: "inicio",         // "inicio": vuelve a la base y se borran los clientes · "cliente": vuelve al último cliente
    segundosExtra: 10,          // tiempo que te queda para terminar después de que llega el chip
    aceleracionEspera: 2,       // si terminas antes que el chip, el resto de su recorrido se ve ×2 (menos espera)
    inactividadMs: 40000,
    // La dificultad sube en cada nivel: más clientes y obras, un chip más rápido que
    // sale antes y calles más angostas (anchoCalle, en fracción de cuadra).
    niveles: [
      // velocidadChip en cuadras por segundo; ventaja = segundos que espera el chip después del "¡Ya!"
      { clientes: 3, obras: 3,  velocidadChip: 1.4, ventaja: 3.0, anchoCalle: 0.44 },
      { clientes: 4, obras: 6,  velocidadChip: 1.8, ventaja: 2.2, anchoCalle: 0.40 },
      { clientes: 5, obras: 9,  velocidadChip: 2.2, ventaja: 1.5, anchoCalle: 0.36 },
      { clientes: 6, obras: 13, velocidadChip: 2.6, ventaja: 1.0, anchoCalle: 0.32 },
    ],
    puntosEficiencia: 500,      // × (cuadras del chip / tus cuadras) × (visitados / total)
    puntosVictoria: 400,
    bonoSinChoques: 100,
    claveRanking: "ganale-al-chip-pulso.ranking",
  };

  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $("hud"), hudNivel: $("hud-nivel"), hudAyuda: $("hud-ayuda"), hudCentro: $("hud-centro"),
    hudTu: $("hud-tu"), hudChip: $("hud-chip"), hudChoques: $("hud-choques"), destello: $("destello"),
    inicio: $("inicio"), aviso: $("aviso"), avisoTexto: $("aviso-texto"),
    resultado: $("resultado"), resTitulo: $("res-titulo"), resDetalle: $("res-detalle"), resPuntos: $("res-puntos"),
    rTiTu: $("r-ti-tu"), rTiGr: $("r-ti-gr"), rCuTu: $("r-cu-tu"), rCuGr: $("r-cu-gr"), rChTu: $("r-ch-tu"),
    btnSiguiente: $("btn-siguiente"),
    final: $("final"), finPuntos: $("fin-puntos"), finRecord: $("fin-record"), finRecordAnt: $("fin-record-ant"), finStats: $("fin-stats"), finTitular: $("fin-titular"), finDato: $("fin-dato"), form: $("form-nombre"), nombre: $("nombre"),
    rankingInicio: $("ranking-inicio"), rankingFinal: $("ranking-final"),
  };
  let vista = new C.Vista($("mapa"));       // "let": la pantalla grande dibuja con otra vista (__vivo)
  const canvas = vista.canvas;
  const ranking = new C.Ranking(AJUSTES.claveRanking);
  const AZUL = C.COLOR.acento, NARANJO = C.COLOR.gr;

  // ---------- Estado ----------
  let fase = "inicio";            // inicio | cuenta | carrera | resultado | final
  let nivelIdx = 0, puntosTotal = 0, victorias = 0, choquesTotal = 0, clientesTotal = 0, completos = 0, cuadrasTu = 0, cuadrasOpt = 0, msOpt = 0;
  let mapa = null, base = 0, clientes = [];
  let chip = null;                // { orden, cuadras, tramos, llegadas[], fin, ms }
  let yo = null;                  // camioneta del jugador (posición en coordenadas de grilla)
  let tCarrera = 0, finCarrera = null, avisoHasta = 0;
  let serieNivel = 0;             // cambia con cada nivel (para la transmisión a la pantalla grande)

  const nivel = () => AJUSTES.niveles[nivelIdx];
  const anchoCalle = () => nivel().anchoCalle ?? AJUSTES.anchoCalle;
  const segs = (t) => t.toFixed(1).replace(".", ",") + " s";

  // ---------- Geometría de calles (coordenadas de grilla: 1 = una cuadra) ----------
  const aGrilla = (x, y) => vista.aGrilla(x, y);
  const aPantalla = (gx, gy) => vista.aPantalla(gx, gy);
  const bloqueada = (a, b) => mapa.bloqueadas.has(a < b ? a + "-" + b : b + "-" + a);   // obra: barrera al medio de la calle
  const cerrada = (a, b) => mapa.cerradas.has(a < b ? a + "-" + b : b + "-" + a);       // dentro de un edificio: toda la calle es pared

  /**
   * ¿El punto está sobre una calle transitable? Devuelve la holgura hasta el
   * borde más cercano (en cuadras) o -1 si chocó.
   */
  function holgura(gx, gy) {
    const h = anchoCalle() / 2, { cols, rows } = mapa;
    if (gx < -h || gx > cols - 1 + h || gy < -h || gy > rows - 1 + h) return -1;
    const rx = Math.round(gx), ry = Math.round(gy);
    const dy = Math.abs(gy - ry), dx = Math.abs(gx - rx);
    const enFila = dy <= h, enCol = dx <= h;
    if (enFila && enCol) return mapa.interiores.has(mapa.id(rx, ry)) ? -1 : h;   // cruce: libre, salvo dentro de un edificio
    if (enFila) {                                                    // calle horizontal
      const k = Math.floor(gx);
      if (k < 0 || k >= cols - 1) return -1;
      if (cerrada(mapa.id(k, ry), mapa.id(k + 1, ry))) return -1;
      if (bloqueada(mapa.id(k, ry), mapa.id(k + 1, ry)) && Math.abs(gx - (k + 0.5)) <= AJUSTES.largoObra) return -1;
      return h - dy;
    }
    if (enCol) {                                                     // calle vertical
      const k = Math.floor(gy);
      if (k < 0 || k >= rows - 1) return -1;
      if (cerrada(mapa.id(rx, k), mapa.id(rx, k + 1))) return -1;
      if (bloqueada(mapa.id(rx, k), mapa.id(rx, k + 1)) && Math.abs(gy - (k + 0.5)) <= AJUSTES.largoObra) return -1;
      return h - dx;
    }
    return -1;                                                       // dentro de una manzana o edificio
  }

  /** Punto proyectado al eje de la calle, para medir cuadras sin contar el zigzag del pulso. */
  function alEje(gx, gy) {
    const h = anchoCalle() / 2, rx = Math.round(gx), ry = Math.round(gy);
    const enFila = Math.abs(gy - ry) <= h, enCol = Math.abs(gx - rx) <= h;
    if (enFila && enCol) return [rx, ry];
    return enFila ? [gx, ry] : [rx, gy];
  }

  // ---------- Reglas ----------
  function prepararChip() {
    const t0 = performance.now();
    const nodos = clientes.map((c) => c.nodo);
    const r = C.rutasOptimas(mapa, base, nodos);
    const full = (1 << nodos.length) - 1;
    const orden = r.orden(full);
    const ms = performance.now() - t0;
    const n = nivel();
    const { tramos, fin } = C.tramosDeRuta(mapa, base, orden.map((i) => nodos[i]), {
      minutosPorCuadra: 1 / n.velocidadChip, servicios: orden.map(() => 0),
    });
    const llegadas = tramos.filter((t) => t.tipo === "servicio").map((t) => t.t0);
    chip = { orden, cuadras: r.costo[full], tramos, llegadas, fin: fin + n.ventaja, ms };
  }

  const chipEn = (t) => Math.max(0, t - nivel().ventaja);          // tiempo "propio" del chip
  const visitadosChip = (t) => chip.llegadas.filter((l) => l <= chipEn(t)).length;

  function reiniciarCamioneta(desde) {
    const [gx, gy] = [mapa.col(desde), mapa.fila(desde)];
    yo.gx = gx; yo.gy = gy; yo.agarrado = false;
    yo.rastro = [[gx, gy]];
  }

  function chocar() {
    yo.choques++;
    ui.destello.classList.remove("activo"); void ui.destello.offsetWidth; ui.destello.classList.add("activo");
    if (AJUSTES.alChocar === "cliente" && yo.visitados.length) {
      reiniciarCamioneta(clientes[yo.visitados[yo.visitados.length - 1]].nodo);
      avisar("¡Chocaste!", "Sigue desde tu último cliente");
    } else {
      yo.visitados = []; yo.cuadras = 0;
      reiniciarCamioneta(base);
      avisar("¡Chocaste!", "Vuelve a empezar desde la base");
    }
    canvas.classList.remove("agarrado");
    actualizarHud();
  }

  /** Mueve la camioneta hacia (gx, gy) revisando el camino en pasos cortos, para que no atraviese manzanas. */
  function mover(gx, gy) {
    const dx = gx - yo.gx, dy = gy - yo.gy;
    const pasos = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.04));
    for (let k = 1; k <= pasos; k++) {
      const px = yo.gx + dx / pasos, py = yo.gy + dy / pasos;
      if (holgura(px, py) < 0) { chocar(); return; }
      const [ax, ay] = alEje(yo.gx, yo.gy), [bx, by] = alEje(px, py);
      yo.cuadras += Math.abs(bx - ax) + Math.abs(by - ay);
      if (Math.hypot(px - yo.gx, py - yo.gy) > 1e-4) yo.ang = Math.atan2(py - yo.gy, px - yo.gx);
      yo.gx = px; yo.gy = py;
      clientes.forEach((c, i) => {
        if (yo.visitados.includes(i)) return;
        if (Math.hypot(px - mapa.col(c.nodo), py - mapa.fila(c.nodo)) <= AJUSTES.radioCliente) yo.visitados.push(i);
      });
      if (yo.visitados.length === clientes.length) { yo.fin = tCarrera; yo.agarrado = false; canvas.classList.remove("agarrado"); break; }
    }
    const ult = yo.rastro[yo.rastro.length - 1];
    if (Math.hypot(yo.gx - ult[0], yo.gy - ult[1]) > 0.05) yo.rastro.push([yo.gx, yo.gy]);
    actualizarHud();
  }

  // ---------- Flujo ----------
  function mostrar(capa) { for (const c of [ui.inicio, ui.aviso, ui.resultado, ui.final]) c.hidden = c !== capa; }

  function avisar(titulo, detalle, ms = 1100) {
    ui.avisoTexto.className = "aviso choque";
    ui.avisoTexto.innerHTML = `${C.escapar(titulo)}<small>${C.escapar(detalle)}</small>`;
    ui.aviso.hidden = false;
    avisoHasta = performance.now() + ms;
  }

  function irAlInicio() {
    fase = "inicio"; mapa = null;
    vistaPrevia();
    ui.hud.hidden = true;
    canvas.classList.remove("agarrable", "agarrado");
    ranking.pintar(ui.rankingInicio, null);
    mostrar(ui.inicio);
    ajustar();
  }

  /** Partida de muestra del nivel 1, solo para verla de fondo detrás del inicio (no empieza). */
  function vistaPrevia() {
    nivelIdx = 0;
    const n = nivel(), v = C.vertical();
    mapa = C.crearCiudad({ cols: v ? 6 : 8, rows: v ? 8 : 6, obras: n.obras });
    base = mapa.elegirBases(1)[0];
    clientes = mapa.elegirNodos(n.clientes, [base], 2).map((nodo) => ({ nodo }));
    prepararChip();
    yo = { gx: 0, gy: 0, ang: 0, agarrado: false, offset: [0, 0], visitados: [], cuadras: 0, choques: 0, fin: null, rastro: [] };
    reiniciarCamioneta(base);
    tCarrera = 0; finCarrera = null;
  }

  function nuevaPartida() { nivelIdx = 0; puntosTotal = 0; victorias = 0; choquesTotal = 0; clientesTotal = 0; completos = 0; cuadrasTu = 0; cuadrasOpt = 0; msOpt = 0; empezarNivel(); }

  function empezarNivel() {
    serieNivel++;
    const n = nivel();
    const v = C.vertical();
    mapa = C.crearCiudad({ cols: v ? 6 : 8, rows: v ? 8 : 6, obras: n.obras });
    base = mapa.elegirBases(1)[0];
    clientes = mapa.elegirNodos(n.clientes, [base], 2).map((nodo) => ({ nodo }));
    prepararChip();
    yo = { gx: 0, gy: 0, ang: 0, agarrado: false, offset: [0, 0], visitados: [], cuadras: 0, choques: 0, fin: null, rastro: [] };
    reiniciarCamioneta(base);
    tCarrera = 0; finCarrera = null;
    ui.hud.hidden = false;
    ui.hudNivel.textContent = `Nivel ${nivelIdx + 1} de ${AJUSTES.niveles.length}`;
    ui.hudAyuda.textContent = tactil() ? "Desliza el dedo en cualquier parte" : "Arrastra la camioneta desde la base";
    ui.hudCentro.classList.remove("urgente");
    ui.hudCentro.textContent = segs(0);
    actualizarHud();
    ajustar();
    fase = "cuenta";
    let k = 3;
    const paso = () => {
      if (fase !== "cuenta") return;
      ui.avisoTexto.className = "aviso cuenta";
      ui.avisoTexto.innerHTML = k > 0 ? String(k) : "¡Ya!";
      mostrar(ui.aviso);
      if (k-- > 0) setTimeout(paso, 750);
      else setTimeout(() => { if (fase === "cuenta") { fase = "carrera"; mostrar(null); } }, 400);
    };
    ui.avisoTexto.className = "aviso";
    ui.avisoTexto.innerHTML = `Nivel ${nivelIdx + 1}<small>${n.clientes} clientes · ${n.obras} obras</small>`;
    mostrar(ui.aviso);
    setTimeout(paso, 1300);
  }

  function actualizarHud() {
    if (!yo) return;
    ui.hudTu.textContent = `${yo.visitados.length}/${clientes.length}`;
    ui.hudChip.textContent = `${visitadosChip(tCarrera)}/${clientes.length}`;
    ui.hudChoques.textContent = yo.choques;
  }

  function terminarNivel() {
    fase = "resultado";
    yo.agarrado = false;
    canvas.classList.remove("agarrable", "agarrado");
    ui.aviso.hidden = true;
    const n = clientes.length, completo = yo.fin != null;
    const gano = completo && yo.fin < chip.fin;
    if (gano) victorias++;
    choquesTotal += yo.choques; clientesTotal += yo.visitados.length;
    msOpt += chip.ms;
    if (completo) { completos++; cuadrasTu += yo.cuadras; cuadrasOpt += chip.cuadras; }
    const eficiencia = yo.cuadras > 0 ? Math.min(1, chip.cuadras / yo.cuadras) * (yo.visitados.length / n) : 0;
    const puntos = Math.round(AJUSTES.puntosEficiencia * eficiencia) + (gano ? AJUSTES.puntosVictoria : 0) +
                   (completo && !yo.choques ? AJUSTES.bonoSinChoques : 0);
    puntosTotal += puntos;

    ui.resTitulo.textContent = gano ? "¡Le ganaste al optimizador!" : completo ? "Ganó el optimizador" : "Se acabó el tiempo";
    ui.rTiTu.textContent = completo ? segs(yo.fin) : `${yo.visitados.length}/${n} clientes`;
    ui.rTiGr.textContent = segs(chip.fin);
    ui.rCuTu.textContent = Math.round(yo.cuadras);
    ui.rCuGr.textContent = chip.cuadras;
    ui.rChTu.textContent = yo.choques;
    const calculo = chip.ms < 1 ? "menos de 1 ms" : `${Math.round(chip.ms)} ms`;
    const extra = completo ? Math.round((yo.cuadras / chip.cuadras - 1) * 100) : null;
    let detalle;
    if (!completo) detalle = `Te faltaron ${n - yo.visitados.length} ${n - yo.visitados.length === 1 ? "cliente" : "clientes"}. `;
    else if (extra <= 2) detalle = "Elegiste el orden óptimo. ";
    else detalle = `Tu recorrido fue ${extra}% más largo. `;
    detalle += `El optimizador calculó su ruta en ${calculo}; los números naranjos muestran su orden.`;
    ui.resDetalle.textContent = detalle;
    ui.resPuntos.textContent = puntos;
    ui.btnSiguiente.textContent = nivelIdx < AJUSTES.niveles.length - 1 ? "Siguiente nivel" : "Ver puntaje";
    ui.hudAyuda.textContent = "Naranjo: la ruta del optimizador";
    mostrar(ui.resultado);
  }

  function siguiente() {
    if (nivelIdx < AJUSTES.niveles.length - 1) { nivelIdx++; empezarNivel(); }
    else terminarPartida();
  }


  /** Pantalla final (mismo formato que ¿Cuál es más corta?): récord anterior y 3 datos. */
  function pintarFinal(puntos, antes, stats) {
    const fmt = (v) => Math.round(v).toLocaleString("es-CL");
    const nuevo = puntos > antes;
    ui.finPuntos.textContent = fmt(puntos);
    ui.finRecord.hidden = !nuevo;
    ui.finRecordAnt.textContent = nuevo ? (antes ? `Tu récord anterior era ${fmt(antes)}` : "") : `Tu récord: ${fmt(antes)}`;
    ui.finStats.innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join("");
  }
  // "Otros juegos": vuelve a la biblioteca (dentro de ella, o a la página de inicio si se abrió suelto)
  $("btn-otros").addEventListener("click", () => {
    try { if (window.parent !== window && window.parent.document) { window.parent.location.hash = ""; return; } } catch { /* sigue abajo */ }
    location.href = "../index.html";
  });

  let registro = null;
  function terminarPartida() {
    fase = "final";
    ui.hud.hidden = true;
    const antes = (ranking.leer()[0] || {}).puntos || 0;
    pintarFinal(puntosTotal, antes, [
      [`${victorias}/${AJUSTES.niveles.length}`, "niveles ganados"],
      [clientesTotal, clientesTotal === 1 ? "cliente" : "clientes"],
      [choquesTotal, choquesTotal === 1 ? "choque" : "choques"],
    ]);
    const GR = '<span class="gr-marca">GoodRoute</span>';
    const calculo = msOpt < 1 ? "menos de 1 ms" : `${Math.round(msOpt)} ms`;
    const extra = completos ? Math.round((cuadrasTu / cuadrasOpt - 1) * 100) : null;
    ui.finTitular.innerHTML = extra == null
      ? `${GR} calculó la ruta óptima de los ${AJUSTES.niveles.length} niveles en ${calculo}, mientras tú manejabas.`
      : extra <= 2
        ? `Manejaste la ruta óptima. ${GR} la calculó en ${calculo}, sin tocar el volante.`
        : `Tu recorrido fue un ${extra}% más largo que la ruta óptima, que ${GR} calculó en ${calculo}.`;
    ui.finDato.innerHTML = `${GR} no maneja: planifica. Arma la ruta óptima de cada técnico en milisegundos, sin choques ni vueltas de más.`;
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
    vista.encuadrar(mapa, { x: 0, y: arriba, w: innerWidth, h: innerHeight - arriba }, Math.min(44, innerWidth * 0.07));
  }

  /** Ciudad con calles anchas (las del juego), manzanas, edificios y obras. */
  function dibujarCiudad() {
    const { ctx } = vista, c = vista.celda, calle = c * anchoCalle();
    const enEdificio = new Set(mapa.edificios.flatMap((e) => e.manzanas));
    for (const e of mapa.edificios) {
      vista.edificio(e, calle, Math.min(8, c * 0.08));
      ctx.strokeStyle = "#cfc3c3"; ctx.lineWidth = 2;
      const [x, y] = vista.px(mapa.id(e.k, e.r));
      const [ew, eh] = vista.medida(e.w, e.h);
      vista.redondeado(x + calle / 2, y + calle / 2, ew * c - calle, eh * c - calle, Math.min(8, c * 0.08)); ctx.stroke();
    }
    for (let r = 0; r < mapa.rows - 1; r++) for (let k = 0; k < mapa.cols - 1; k++) {
      if (enEdificio.has(mapa.id(k, r))) continue;
      const [x, y] = vista.px(mapa.id(k, r));
      vista.redondeado(x + calle / 2, y + calle / 2, c - calle, c - calle, Math.min(8, c * 0.08));
      ctx.fillStyle = C.COLOR.manzana; ctx.fill();
      ctx.strokeStyle = "#cfc3c3"; ctx.lineWidth = 2; ctx.stroke();
    }
    // Borde del mapa
    const [x0, y0] = vista.px(0), [x1, y1] = vista.px(mapa.id(mapa.cols - 1, mapa.rows - 1));
    vista.redondeado(x0 - calle / 2, y0 - calle / 2, x1 - x0 + calle, y1 - y0 + calle, Math.min(10, calle / 2));
    ctx.strokeStyle = "#cfc3c3"; ctx.lineWidth = 2; ctx.stroke();
    // Obras: barrera a lo ancho de la calle
    for (const kk of mapa.bloqueadas) {
      const [a, b] = kk.split("-").map(Number);
      const [xa, ya] = vista.px(a), [xb, yb] = vista.px(b);
      ctx.save();
      ctx.translate((xa + xb) / 2, (ya + yb) / 2);
      if (xa === xb) ctx.rotate(Math.PI / 2);
      const w = c * AJUSTES.largoObra * 2, h = calle;
      ctx.fillStyle = C.COLOR.obra; vista.redondeado(-w / 2, -h / 2, w, h, 3); ctx.fill();
      ctx.fillStyle = C.COLOR.blanco;
      for (const s of [-1, 0, 1]) ctx.fillRect(-w / 2, s * h / 3.2 - 2, w, 4);
      ctx.restore();
    }
  }

  function dibujar() {
    vista.limpiar();
    if (!mapa) return;
    dibujarCiudad();
    const { ctx } = vista, c = vista.celda, ahora = performance.now();
    const revisando = fase === "resultado";

    // Chip: ruta hasta donde va y su camioneta
    const tChip = revisando ? Infinity : chipEn(tCarrera);
    vista.trazar(chip.tramos, tChip, NARANJO, Math.max(6, c * 0.09), revisando ? 0.55 : 0.4);

    // Tu rastro desde el último choque
    if (yo.rastro.length > 1) {
      ctx.save();
      ctx.strokeStyle = AZUL; ctx.globalAlpha = 0.75; ctx.lineWidth = Math.max(3, c * 0.045);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      yo.rastro.forEach(([gx, gy], k) => { const [x, y] = aPantalla(gx, gy); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.lineTo(...aPantalla(yo.gx, yo.gy));
      ctx.stroke();
      ctx.restore();
    }

    vista.base(base, C.COLOR.base, "BASE");

    // Clientes: azul con tu número de visita; al final, el orden del chip en naranjo
    clientes.forEach((cl, i) => {
      const k = yo.visitados.indexOf(i);
      vista.pin(cl.nodo, {
        relleno: k >= 0 ? AZUL : C.COLOR.blanco, borde: k >= 0 ? AZUL : C.COLOR.gris,
        texto: k >= 0 ? String(k + 1) : "", discontinuo: k < 0, radio: Math.max(12, c * 0.16),
      });
      if (revisando) {
        const pos = chip.orden.indexOf(i);
        const [x, y] = vista.px(cl.nodo), r = Math.max(12, c * 0.16), er = r * 0.6;
        const ex = x + r * 0.95, ey = y - r * 0.85;
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fillStyle = NARANJO; ctx.fill();
        ctx.fillStyle = C.COLOR.blanco; ctx.font = `700 ${er * 1.1}px "IBM Plex Sans", sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(pos + 1), ex, ey + 1);
      }
    });

    // Camioneta del chip (con un chip blanco en el techo)
    const pc = vista.posicion(chip.tramos, Math.min(tChip, chip.fin), base);
    vista.furgon(pc, NARANJO);
    ctx.save(); ctx.translate(pc.x, pc.y); ctx.rotate(pc.ang);
    const t = Math.max(7, c * 0.09);
    ctx.fillStyle = C.COLOR.blanco; ctx.fillRect(-t * 1.4, -t / 2, t, t);
    ctx.fillStyle = NARANJO; ctx.fillRect(-t * 1.4 + t * 0.28, -t * 0.22, t * 0.44, t * 0.44);
    ctx.restore();

    // Tu camioneta
    const [x, y] = aPantalla(yo.gx, yo.gy);
    if (fase === "carrera" && yo.fin == null) {
      const hol = holgura(yo.gx, yo.gy), h = anchoCalle() / 2;
      if (!yo.agarrado) {
        // Invita a agarrarla
        const r = Math.max(22, c * 0.3) + 5 * Math.sin(ahora / 180);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.lineWidth = 3; ctx.strokeStyle = AZUL; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      } else if (hol >= 0 && hol < h * 0.35) {
        // ¡Uh, casi! Muy cerca del borde
        ctx.beginPath(); ctx.arc(x, y, Math.max(20, c * 0.26), 0, Math.PI * 2);
        ctx.lineWidth = 4; ctx.strokeStyle = C.COLOR.tarde; ctx.stroke();
      }
    }
    vista.furgon({ x, y, ang: vista.angulo(yo.ang) }, AZUL);
    if (fase === "carrera" && !yo.agarrado && yo.fin == null && ui.aviso.hidden) {
      const fs = Math.max(12, Math.min(16, c * 0.16));
      ctx.font = `600 ${fs}px "IBM Plex Sans", sans-serif`;
      const txt = tactil() ? "Desliza en cualquier parte" : "Arrastra desde aquí", w = ctx.measureText(txt).width + fs;
      // Debajo de la camioneta (o encima, si no cabe), sin salirse de la pantalla
      let ey = y + Math.max(26, c * 0.34) + fs;
      if (ey + fs > innerHeight - 8) ey = y - Math.max(26, c * 0.34) - fs;
      const ex = Math.max(w / 2 + 8, Math.min(innerWidth - w / 2 - 8, x));
      vista.redondeado(ex - w / 2, ey - fs * 0.8, w, fs * 1.6, fs * 0.8); ctx.fillStyle = AZUL; ctx.fill();
      ctx.fillStyle = C.COLOR.blanco; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, ex, ey + 1);
    }
  }

  // ---------- Entrada ----------
  const enCarrera = () => fase === "carrera" && yo.fin == null && finCarrera == null;
  const tactil = () => matchMedia("(pointer: coarse)").matches;
  if (tactil()) $("paso-arrastre").lastChild.textContent = "Desliza el dedo en cualquier parte de la pantalla: la camioneta copia su movimiento. Llévala por las calles hasta todos los clientes.";

  canvas.addEventListener("pointerdown", (e) => {
    if (!enCarrera() || yo.agarrado) return;
    const [x, y] = aPantalla(yo.gx, yo.gy);
    if (e.pointerType === "mouse" && Math.hypot(e.clientX - x, e.clientY - y) > Math.max(34, vista.celda * 0.45)) return;
    yo.agarrado = true;
    yo.offset = [x - e.clientX, y - e.clientY];   // la camioneta no salta al dedo
    ui.aviso.hidden = true;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.classList.add("agarrado");
    ui.hudAyuda.textContent = "Pasa por todos los clientes sin tocar los bordes";
  });
  canvas.addEventListener("pointermove", (e) => {
    if (fase === "carrera" && !yo.agarrado) {
      const [x, y] = aPantalla(yo.gx, yo.gy);
      canvas.classList.toggle("agarrable", enCarrera() && Math.hypot(e.clientX - x, e.clientY - y) <= Math.max(34, vista.celda * 0.45));
    }
    if (!enCarrera() || !yo.agarrado) return;
    const juntos = e.getCoalescedEvents?.();
    const eventos = juntos && juntos.length ? juntos : [e];
    for (const ev of eventos) {
      if (!yo.agarrado) break;
      const [gx, gy] = aGrilla(ev.clientX + yo.offset[0], ev.clientY + yo.offset[1]);
      mover(gx, gy);
    }
  });
  const soltar = () => { if (yo) { yo.agarrado = false; canvas.classList.remove("agarrado"); } };
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);

  $("btn-jugar").addEventListener("click", nuevaPartida);
  $("btn-otra").addEventListener("click", nuevaPartida);
  ui.btnSiguiente.addEventListener("click", siguiente);
  addEventListener("resize", ajustar);

  C.modoStand({
    inactividadMs: AJUSTES.inactividadMs,
    enJuego: () => fase !== "inicio" && !(yo && yo.agarrado),
    alInactivo: irAlInicio,
    ranking,
    alBorrar: () => ranking.pintar(ui.rankingInicio, null),
  });

  // ---------- Bucle ----------
  let anterior = performance.now();
  function cuadro(ahora) {
    const dt = Math.min((ahora - anterior) / 1000, 0.05);
    anterior = ahora;
    if (fase === "carrera") {
      // Si ya terminaste y el chip sigue en camino, su recorrido se acelera (×2) para esperar menos.
      // El resultado no cambia: los tiempos se comparan en el tiempo del juego.
      const esperando = yo.fin != null && tCarrera < chip.fin;
      tCarrera += dt * (esperando ? AJUSTES.aceleracionEspera : 1);
      if (esperando) ui.hudAyuda.textContent = `¡Terminaste! El optimizador termina su ruta (×${AJUSTES.aceleracionEspera})`;
      if (avisoHasta && ahora > avisoHasta) { ui.aviso.hidden = true; avisoHasta = 0; }
      const chipLlego = tCarrera >= chip.fin;
      if (yo.fin == null && chipLlego) {
        const queda = chip.fin + AJUSTES.segundosExtra - tCarrera;
        ui.hudCentro.textContent = `+${Math.max(0, Math.ceil(queda))} s`;
        ui.hudCentro.classList.add("urgente");
        ui.hudAyuda.textContent = "¡El optimizador ya llegó! Termina antes de que se acabe el tiempo";
        if (queda <= 0 && finCarrera == null) finCarrera = ahora;
      } else ui.hudCentro.textContent = segs(yo.fin ?? tCarrera);
      actualizarHud();
      if (finCarrera == null && yo.fin != null && chipLlego) finCarrera = ahora;
      if (finCarrera != null && ahora - finCarrera > 600) terminarNivel();
    }
    dibujar();
    requestAnimationFrame(cuadro);
  }

  // ---------- Transmisión a la pantalla grande (multi.js) ----------
  // El celular manda la ciudad y la ruta del optimizador una vez por nivel, y la camioneta,
  // el reloj y el rastro cuando cambian; la pantalla grande dibuja con este mismo código.
  const r3 = (v) => Math.round(v * 1000) / 1000;
  function rastroCorto() {
    const r = yo.rastro, out = [];
    let ult = null;
    for (const p of r) if (!ult || Math.hypot(p[0] - ult[0], p[1] - ult[1]) >= 0.12) { out.push([r3(p[0]), r3(p[1])]); ult = p; }
    return out;
  }
  window.__vivo = {
    clave: () => (mapa && yo && chip && ["cuenta", "carrera", "resultado"].includes(fase) ? `r${serieNivel}` : null),
    nivel: () => ({ d: C.datosCiudad(mapa), base, cl: clientes.map((c) => c.nodo), chip, ni: nivelIdx }),
    estado: () => ({
      f: fase, t: Math.round(tCarrera * 100) / 100, x: r3(yo.gx), y: r3(yo.gy), a: Math.round(yo.ang * 100) / 100,
      v: yo.visitados, g: yo.agarrado ? 1 : 0, fin: yo.fin, r: rastroCorto(),
    }),
    pintar(el, nv, e, cache) {
      let cv = el.querySelector("canvas");
      if (!cv) { el.innerHTML = ""; cv = document.createElement("canvas"); el.append(cv); }
      const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      if (!cache.vista || cache.vista.canvas !== cv) cache.vista = new C.Vista(cv);
      if (!cache.mapa) cache.mapa = C.crearCiudad({ datos: nv.d });
      const v = cache.vista, m = cache.mapa;
      v.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      v.encuadrar(m, { x: 0, y: 0, w, h }, Math.min(30, w * 0.05));
      const antes = { vista, mapa, base, clientes, chip, yo, tCarrera, fase, nivelIdx };
      vista = v; mapa = m; base = nv.base; clientes = nv.cl.map((nodo) => ({ nodo })); chip = nv.chip; nivelIdx = nv.ni;
      yo = { gx: e.x, gy: e.y, ang: e.a, agarrado: !!e.g, visitados: e.v || [], fin: e.fin, rastro: e.r || [], offset: [0, 0], cuadras: 0, choques: 0 };
      tCarrera = e.t; fase = e.f;
      try { dibujar(); } finally { ({ vista, mapa, base, clientes, chip, yo, tCarrera, fase, nivelIdx } = antes); }
    },
  };

  window.__estadoJuego = () => ({ fase, nivelIdx, mapa, base, clientes, chip, yo, vista, tCarrera, puntosTotal, holgura });

  irAlInicio();
  requestAnimationFrame(cuadro);
})();
