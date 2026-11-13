/* multi.js — "Jugar con celulares" para los minijuegos individuales de GoodRoute.
 *
 * Se agrega a un juego sin cambiar su lógica. El juego solo tiene que tener:
 *   - #inicio con #btn-jugar (empieza la partida) y .reglas;
 *   - window.__estadoJuego() con { fase, puntosTotal } (fase "final" = terminó);
 *   - window.__vivo (recomendado): la pantalla grande dibuja cada partida con el código del
 *     propio juego, nítida a cualquier tamaño, y los celulares mandan solo datos chicos:
 *       clave()   → id del nivel en curso (o null si no hay nada que mostrar);
 *       nivel()   → datos fijos del nivel (se mandan una vez por nivel);
 *       estado()  → datos que cambian (se mandan cuando cambian, hasta 15 veces por segundo);
 *       pintar(el, nivel, estado, cache) → dibuja en el elemento el (cache: objeto por nivel).
 *   - si no hay __vivo: un <canvas> o un <svg data-transmitir>, que se manda como imagen.
 *
 * En la pantalla del stand (computador):
 *   1. Se elige cuántos juegan (1 a 6) y se toca "Jugar con celulares".
 *   2. Aparece un QR a la vez, en orden. Cada celular confirma "¡Estoy listo!".
 *   3. Cuando todos confirmaron, la partida empieza en todos los celulares a la
 *      vez con los mismos desafíos (Math.random con la misma semilla).
 *   4. Mientras juegan, la pantalla muestra un cuadro por jugador con una imagen
 *      en vivo de su juego, su color y sus puntos. Al final, el podio.
 *   5. "Terminar partida" (solo aquí) corta el juego en todos los celulares.
 *
 * En el celular (la misma página con ?sala=CÓDIGO&j=N): espera, confirma, juega
 * y manda su puntaje y una imagen reducida de su pantalla unas 3 veces por segundo.
 *
 * Usa online.js (sala, QR y conexión por Firebase o ?prueba=1).
 * Configuración en la etiqueta <script>: data-juego (id de la sala) y data-ranking (clave del ranking).
 * Este archivo es igual en las carpetas de los juegos que lo usan.
 */
(() => {
  "use strict";
  const O = window.Online;
  const etiqueta = document.currentScript;
  const JUEGO = etiqueta?.dataset.juego || location.pathname.split("/").slice(-2, -1)[0] || "juego";
  const CLAVE_RANKING = etiqueta?.dataset.ranking || `${JUEGO}.ranking`;
  const AJUSTES = {
    puntosPorSegundo: 3,
    imagenesPorSegundo: 10,    // como máximo; si la red no da, se saltan cuadros en vez de acumular atraso
    imagenesEnVuelo: 2,
    // Tamaño de la imagen que manda cada celular: el de su recuadro en la pantalla grande
    // (la pantalla lo mide y lo avisa al empezar), entre estos límites.
    ladoImagen: 480,           // px del lado más largo, si la pantalla no avisó
    ladoMin: 360, ladoMax: 1100,
    calidadImagen: 0.78,
    datosPorSegundo: 15,       // con window.__vivo
    segundosAutoInicio: 1.5,   // cuando todos confirmaron
  };
  const JUGADORES = [
    { nombre: "Azul", color: "#2f6fd6" }, { nombre: "Naranjo", color: "#E8772E" }, { nombre: "Verde", color: "#1f9d6b" },
    { nombre: "Morado", color: "#7c54c9" }, { nombre: "Rosa", color: "#c23b7a" }, { nombre: "Turquesa", color: "#0f8b8d" },
  ];
  const GR = '<span class="gr-marca">GoodRoute</span>';
  const PITCH = {
    "ganale-al-chip-pulso": {
      titular: `Mientras ustedes manejaban, ${GR} calculó la ruta óptima de cada nivel en milisegundos.`,
      dato: `${GR} no maneja: planifica. Arma la ruta óptima de cada técnico en milisegundos, sin choques ni vueltas de más.`,
    },
    "jornada-perfecta": {
      titular: `${GR} llega a la hora a cada cliente y arma el día completo en milisegundos.`,
      dato: `${GR} toma la hora acordada con cada cliente como una regla del plan: ordena las visitas para cumplirla y, entre las rutas que la cumplen, elige la más corta.`,
    },
    "modo-goodroute": {
      titular: `Lo que a ustedes les tomó minutos, ${GR} lo resuelve en segundos, cumpliendo todas las reglas a la vez.`,
      dato: `Hoy la dispatcher considera todos estos objetivos a mano.<br>${GR} entrega la propuesta lista, en segundos.`,
    },
  }[JUEGO] || { titular: "", dato: "" };
  const SEGUNDOS_NOMBRE = 120;
  const votoHTML = () => `<div class="voto-pista">${Array.from({ length: 2 }, () => Array.from({ length: 14 }, () => "<span>Vota <b>GoodRoute</b></span><i>·</i>").join("")).join("")}</div>`;
  const volverAlHub = () => {
    try { if (window.parent !== window && window.parent.document) { window.parent.location.hash = ""; return; } } catch { /* sigue abajo */ }
    location.href = "../index.html";
  };
  const params = new URLSearchParams(location.search);
  const SALA = params.get("sala"), YO = Number(params.get("j")) - 1;
  const ES_CELULAR = !!(SALA && JUGADORES[YO]);

  const $ = (id) => document.getElementById(id);
  const estado = () => { try { return window.__estadoJuego ? window.__estadoJuego() : {}; } catch { return {}; } };
  const puntosJuego = () => Math.max(0, Math.round(Number(estado().puntosTotal) || 0));
  const fmt = (n) => Math.round(n).toLocaleString("es-CL");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const crear = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const leerJSON = (s) => { try { return typeof s === "string" ? JSON.parse(s) : null; } catch { return null; } };

  /** Math.random con semilla (mulberry32): todos los celulares generan los mismos desafíos. */
  function sembrar(semilla) {
    let a = semilla >>> 0;
    Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // =====================================================================
  // Pantalla del stand
  // =====================================================================
  function iniciarPantalla() {
    const btnJugar = $("btn-jugar");
    if (!btnJugar) return;
    let nJug = 1, sala = null, estadoSala = "", jug = [], preparados = {}, autoInicio = 0, semilla = 0;
    let vivoJuego = null, forzando = false, forzarT = 0, nombresSala = {};
    const limpio = (n) => (typeof n === "string" ? n.trim().slice(0, 14) : "");
    const nombreDe = (p) => limpio(nombresSala[p]) || JUGADORES[p].nombre;
    const SEGUNDOS_FORZAR = 30;

    // ---------- En la tarjeta de inicio: cuántos juegan y cómo ----------
    const bloque = crear(`<div class="multi-modos">
      <p class="multi-cuantos">¿Cuántos juegan?</p>
      <div class="multi-num" role="group" aria-label="Cantidad de jugadores"></div>
      <button class="btn multi-btn-cel" type="button">Jugar con celulares</button>
      <p class="multi-nota"></p>
    </div>`);
    btnJugar.parentNode.insertBefore(bloque, btnJugar);
    const btnCel = bloque.querySelector(".multi-btn-cel"), nota = bloque.querySelector(".multi-nota");
    btnJugar.insertAdjacentElement("afterend", btnCel);      // Jugar aquí · Jugar con celulares · nota
    btnCel.insertAdjacentElement("afterend", nota);
    btnJugar.classList.add("multi-jugar-aqui");
    const textoJugar = btnJugar.textContent;
    function pintarNumeros() {
      bloque.querySelector(".multi-num").innerHTML = [1, 2, 3, 4, 5, 6].map((n) =>
        `<button type="button" data-n="${n}" aria-pressed="${n === nJug}">${n}</button>`).join("");
      const motivo = O ? O.motivoNoDisponible() : "No se pudo cargar la conexión.";
      btnCel.disabled = !!motivo;
      btnJugar.disabled = nJug > 1;
      btnJugar.textContent = textoJugar;
      nota.textContent = motivo ? motivo : nJug > 1 ? "Con más de un jugador, cada uno juega en su celular." : "";
    }
    bloque.querySelector(".multi-num").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-n]");
      if (b) { nJug = Number(b.dataset.n); pintarNumeros(); }
    });
    pintarNumeros();

    // ---------- Capas: sala con QR, partida en vivo y podio ----------
    const capaSala = crear(`<section class="multi-capa" hidden>
      <div class="multi-panel multi-panel-sala">
        <p class="multi-eyebrow">${esc(document.title.split("·")[0].trim())} · con celulares</p>
        <h2>Escanea el QR cuando sea tu turno</h2>
        <div class="qr-grilla"></div>
        <div class="sala-pie">
          <button class="btn multi-empezar" type="button" disabled>Esperando jugadores…</button>
          <button class="btn btn-secundario multi-volver" type="button">Volver</button>
        </div>
        <p class="sala-codigo"></p>
      </div>
    </section>`);
    const capaVivo = crear(`<section class="multi-vivo" hidden>
      <div class="multi-cuadros"></div>
      <button class="btn btn-secundario multi-terminar" type="button">Terminar partida</button>
      <div class="voto-barra" aria-hidden="true">${votoHTML()}</div>
    </section>`);
    const capaPodio = crear(`<section class="multi-capa" hidden>
      <div class="multi-panel">
        <p class="multi-eyebrow">${esc(document.title.split("·")[0].trim())} · resultado</p>
        <h2 class="multi-podio-titulo"></h2>
        <ol class="multi-lista"></ol>
        <div class="multi-pitch">
          ${PITCH.titular ? `<p class="dato-tit">${PITCH.titular}</p>` : ""}
          ${PITCH.dato ? `<p class="dato-txt">${PITCH.dato}</p>` : ""}
        </div>
        <p class="multi-pide-nombre" hidden></p>
        <div class="multi-botones">
          <button class="btn multi-otra" type="button">Jugar de nuevo</button>
          <button class="btn multi-hub" type="button">Volver al HUB</button>
        </div>
      </div>
    </section>`);
    document.body.append(capaVivo, capaSala, capaPodio);
    const grilla = capaSala.querySelector(".qr-grilla"), btnEmpezar = capaSala.querySelector(".multi-empezar");

    async function abrirSala() {
      if (!O || !O.disponible()) return;
      $("inicio").hidden = true; capaSala.hidden = false;
      grilla.innerHTML = ""; capaSala.querySelector(".sala-codigo").textContent = "";
      btnEmpezar.disabled = true; btnEmpezar.textContent = "Conectando…";
      try {
        sala = await O.crearSala(JUEGO, nJug, { control: "index.html" });
        const actualizarQR = await O.pintarSala(grilla, sala, JUGADORES.slice(0, nJug));
        capaSala.querySelector(".sala-codigo").textContent = `Sala ${sala.codigo}`;
        jug = JUGADORES.slice(0, nJug).map(() => ({ conectado: false, puntos: 0, listo: false, imagen: null }));
        preparados = {};
        sala.alJugadores((v) => { jug.forEach((j, p) => (j.conectado = !!v[p])); actualizarQR(v); revisarSala(); pintarVivo(); });
        sala.alEntrada(recibir);
        sala.alValor("listos", (v) => { preparados = v || {}; revisarSala(); });
        nombresSala = {};
        sala.alValor("nombres", (v) => { nombresSala = v || {}; revisarSala(); pintarVivo(); });
        jug.forEach((_, p) => {
          sala.alValor(`vivoNivel/${p}`, (s) => { const v = leerJSON(s); if (v && jug[p]) { jug[p].nivel = v; jug[p].cache = {}; O.actividad(); dibujarDatos(p); } });
          sala.alValor(`vivoEstado/${p}`, (s) => { const v = leerJSON(s); if (v && jug[p]) { jug[p].estado = v; O.actividad(); dibujarDatos(p); } });
        });
        jug.forEach((_, p) => sala.alValor(`imagenes/${p}`, (img) => {
          if (!img || !jug[p]) return;
          jug[p].imagen = img; O.actividad();
          const el = capaVivo.querySelector(`.multi-cuadro[data-p="${p}"] img`);
          if (el) { el.src = img; el.hidden = false; }
        }));
        estadoSala = "sala"; revisarSala();
      } catch (e) {
        cerrar(); $("inicio").hidden = false;
        nota.textContent = "No se pudo conectar: " + (e.message || e) + " Puedes jugar en esta pantalla.";
      }
    }

    const todos = () => jug.length && jug.every((j) => j.conectado);
    const todosListos = () => todos() && jug.every((_, p) => preparados[p]);
    function revisarSala() {
      if (estadoSala !== "sala") return;
      clearTimeout(autoInicio);
      const n = jug.filter((j) => j.conectado).length, nl = jug.filter((_, p) => preparados[p]).length;
      const zona = grilla.querySelector(".qr-listos");
      if (zona) zona.innerHTML = todos()
        ? `${todosListos() ? "¡Todos listos!" : "Confirmen en su celular: ¿están listos?"}<div class="multi-listos">${jug.map((_, p) =>
            `<span class="${preparados[p] ? "si" : ""}"><i style="background:${JUGADORES[p].color}">${p + 1}</i>${esc(nombreDe(p))}${preparados[p] ? " ✓" : "…"}</span>`).join("")}</div>`
        : "";
      if (todosListos()) {
        btnEmpezar.disabled = false; btnEmpezar.textContent = "¡Empezar!";
        autoInicio = setTimeout(() => { if (estadoSala === "sala" && todosListos()) empezar(); }, AJUSTES.segundosAutoInicio * 1000);
      } else if (todos()) { btnEmpezar.disabled = true; btnEmpezar.textContent = `Esperando confirmación… ${nl} de ${nJug} listos`; }
      else { btnEmpezar.disabled = true; btnEmpezar.textContent = `Esperando jugadores… ${n} de ${nJug}`; }
    }

    function empezar() {
      clearTimeout(autoInicio);
      semilla = Math.floor(Math.random() * 2 ** 31);
      estadoSala = "jugar";
      jug.forEach((j) => { j.puntos = 0; j.listo = false; j.delegado = false; j.etapa = ""; });
      capaSala.hidden = true; capaVivo.hidden = false;
      capaVivo.querySelector(".multi-cuadros").style.setProperty("--n", nJug);
      capaVivo.querySelector(".multi-cuadros").dataset.n = nJug;
      capaVivo.querySelector(".multi-cuadros").innerHTML = jug.map((_, p) => `<div class="multi-cuadro" data-p="${p}" style="--color:${JUGADORES[p].color}">
        <div class="multi-cuadro-cab"><b>${p + 1}</b><span>${esc(nombreDe(p))}</span><i class="multi-nivel" hidden></i><em class="multi-pts">0 pts</em></div>
        <div class="multi-cuadro-cuerpo"><img alt="" hidden><div class="multi-dibujo" hidden></div><p class="multi-espera">Esperando su partida…</p><p class="multi-termino" hidden>✓ Terminó</p></div>
      </div>`).join("");
      // Tamaño real de cada recuadro (en px de pantalla): los celulares mandan imágenes de ese tamaño.
      const cuerpo = capaVivo.querySelector(".multi-cuadro-cuerpo");
      const escala = Math.min(window.devicePixelRatio || 1, 1.5);
      const lado = cuerpo ? Math.round(Math.max(cuerpo.clientWidth, cuerpo.clientHeight) * escala) : AJUSTES.ladoImagen;
      vivoJuego = { fase: "jugar", semilla, lado: Math.max(AJUSTES.ladoMin, Math.min(AJUSTES.ladoMax, lado)) };
      forzando = false; clearTimeout(forzarT);
      const btnTerminar = capaVivo.querySelector(".multi-terminar");
      btnTerminar.disabled = false; btnTerminar.textContent = "Terminar partida";
      sala.publicar("vivo", vivoJuego);
      pintarVivo();
    }

    /** Dibuja la partida del jugador p con el código del juego (window.__vivo), una vez por cuadro. */
    const pendientes = new Set();
    function dibujarDatos(p) {
      if (!window.__vivo || pendientes.has(p)) return;
      pendientes.add(p);
      requestAnimationFrame(() => {
        pendientes.delete(p);
        const j = jug[p], c = capaVivo.querySelector(`.multi-cuadro[data-p="${p}"]`);
        if (!j || !c || !j.nivel || !j.estado || j.nivel.c !== j.estado.c) return;
        const el = c.querySelector(".multi-dibujo");
        el.hidden = false;
        c.querySelector("img").hidden = true;
        c.querySelector(".multi-espera").hidden = true;
        try { window.__vivo.pintar(el, j.nivel.d, j.estado.e, j.cache || (j.cache = {})); } catch (e) { console.warn("vivo", e); }
      });
    }
    addEventListener("resize", () => jug.forEach((_, p) => dibujarDatos(p)));

    function recibir(m) {
      const p = Number(m.p), j = jug[p];
      if (!j || estadoSala !== "jugar") return;
      if (m.tipo === "puntos") { j.puntos = Math.max(j.puntos, Math.round(m.puntos || 0)); if (typeof m.nivel === "string") j.etapa = m.nivel; }
      else if (m.tipo === "fin") { j.puntos = Math.max(0, Math.round(m.puntos || 0)); j.listo = true; j.delegado = !!m.delegado; }
      pintarVivo();
      if (jug.every((x) => x.listo || !x.conectado)) setTimeout(() => { if (estadoSala === "jugar") podio(); }, 1200);
    }

    function pintarVivo() {
      if (estadoSala !== "jugar") return;
      jug.forEach((j, p) => {
        const c = capaVivo.querySelector(`.multi-cuadro[data-p="${p}"]`);
        if (!c) return;
        c.querySelector(".multi-pts").textContent = `${fmt(j.puntos)} pts`;
        c.querySelector(".multi-cuadro-cab span").textContent = nombreDe(p);
        const nivel = c.querySelector(".multi-nivel");
        nivel.textContent = j.etapa || ""; nivel.hidden = !j.etapa;
        c.querySelector(".multi-termino").hidden = !j.listo;
        c.querySelector(".multi-termino").textContent = j.delegado ? "✓ Delegado a GoodRoute" : "✓ Terminó";
        c.querySelector(".multi-espera").textContent = j.conectado ? "Esperando su partida…" : "Desconectado";
        c.classList.toggle("listo", j.listo);
      });
    }

    let cierrePodio = 0;
    function pintarPodio(o, nombres) {
      const quien = (p) => nombres[p] || JUGADORES[p].nombre;
      capaPodio.querySelector(".multi-podio-titulo").textContent = o.length > 1 && o[0].puntos > 0 ? `¡Gana ${quien(o[0].p)}!` : "¡Terminó!";
      capaPodio.querySelector(".multi-lista").innerHTML = o.map((j, k) => `<li class="${k === 0 ? "primero" : ""}">
        <span class="pos">${k + 1}º</span><span class="num" style="background:${JUGADORES[j.p].color}">${j.p + 1}</span>
        <span class="quien">${esc(quien(j.p))}</span><span class="pts">${fmt(j.puntos)}</span></li>`).join("");
    }

    function terminarPartida() {
      if (estadoSala !== "jugar") return;
      const faltan = jug.some((j) => j.conectado && !j.listo);
      if (typeof window.__forzarFin !== "function" || !faltan || !vivoJuego) { podio(); return; }
      if (forzando) return;
      forzando = true;
      const btnTerminar = capaVivo.querySelector(".multi-terminar");
      btnTerminar.disabled = true; btnTerminar.textContent = "Resolviendo con GoodRoute…";
      sala.publicar("vivo", { ...vivoJuego, forzar: true });
      forzarT = setTimeout(podio, SEGUNDOS_FORZAR * 1000);
    }

    function podio() {
      if (estadoSala !== "jugar") return;
      clearTimeout(forzarT);
      estadoSala = "podio";
      const o = jug.map((j, p) => ({ ...j, p })).sort((a, b) => b.puntos - a.puntos || a.p - b.p);
      const ganador = o[0] && o[0].puntos > 0 ? o[0] : null;
      const nombres = {};
      jug.forEach((_, p) => { const n = limpio(nombresSala[p]); if (n) nombres[p] = n; });
      pintarPodio(o, nombres);
      capaVivo.querySelector(".multi-terminar").hidden = true;
      const aviso = capaPodio.querySelector(".multi-pide-nombre");
      aviso.hidden = !ganador;
      if (ganador) aviso.innerHTML = nombres[ganador.p]
        ? `<i style="background:${JUGADORES[ganador.p].color}">${ganador.p + 1}</i>${esc(nombres[ganador.p])} quedó en el ranking.`
        : `<i style="background:${JUGADORES[ganador.p].color}">${ganador.p + 1}</i>${JUGADORES[ganador.p].nombre}: escribe tu nombre en el celular para el ranking.`;
      capaPodio.hidden = false;
      const vivo = { fase: "podio", podio: o.map((j) => ({ p: j.p, puntos: j.puntos })), pideNombre: ganador ? ganador.p : -1 };
      if (!ganador) { sala.cerrar(vivo); sala = null; return; }
      const registro = { nombre: nombres[ganador.p] || JUGADORES[ganador.p].nombre, puntos: ganador.puntos, t: Date.now() };
      const guardar = (cambiar) => {
        try {
          let lista = JSON.parse(localStorage.getItem(CLAVE_RANKING)) || [];
          lista = cambiar(lista);
          localStorage.setItem(CLAVE_RANKING, JSON.stringify(lista.sort((a, b) => b.puntos - a.puntos || a.t - b.t).slice(0, 10)));
        } catch { /* sin almacenamiento */ }
      };
      guardar((l) => [...l, registro]);
      const actual = sala;
      actual.publicar("vivo", vivo);
      const terminarSala = () => { clearTimeout(cierrePodio); if (sala === actual) { actual.cerrar(); sala = null; } };
      actual.alValor("nombres", (v) => {
        const n = v && typeof v[ganador.p] === "string" ? v[ganador.p].trim().slice(0, 14) : "";
        if (!n || sala !== actual) return;
        nombres[ganador.p] = n;
        guardar((l) => l.map((r) => (r.t === registro.t && r.puntos === registro.puntos ? { ...r, nombre: n } : r)));
        pintarPodio(o, nombres);
        aviso.innerHTML = `<i style="background:${JUGADORES[ganador.p].color}">${ganador.p + 1}</i>${esc(n)} quedó en el ranking.`;
        Promise.resolve(actual.publicar("vivo", { ...vivo, nombreOk: n })).catch(() => {}).finally(terminarSala);
      });
      clearTimeout(cierrePodio);
      cierrePodio = setTimeout(terminarSala, SEGUNDOS_NOMBRE * 1000);
    }

    function cerrar() {
      clearTimeout(autoInicio); clearTimeout(cierrePodio); clearTimeout(forzarT);
      forzando = false;
      if (sala) sala.cerrar();
      sala = null; estadoSala = "";
      capaSala.hidden = true; capaVivo.hidden = true; capaPodio.hidden = true;
      capaVivo.querySelector(".multi-terminar").hidden = false;
    }

    btnCel.addEventListener("click", abrirSala);
    btnEmpezar.addEventListener("click", () => { if (estadoSala === "sala" && todosListos()) empezar(); });
    capaSala.querySelector(".multi-volver").addEventListener("click", () => { cerrar(); $("inicio").hidden = false; pintarNumeros(); });
    capaVivo.querySelector(".multi-terminar").addEventListener("click", terminarPartida);
    capaPodio.querySelector(".multi-otra").addEventListener("click", () => { cerrar(); $("inicio").hidden = false; pintarNumeros(); });
    capaPodio.querySelector(".multi-hub").addEventListener("click", () => { cerrar(); volverAlHub(); });

    window.__multi = { estado: () => ({ estadoSala, jug, preparados }), urlDe: (p) => (sala ? sala.urlControl(p) : null) };
  }

  // =====================================================================
  // Celular
  // =====================================================================
  function iniciarCelular() {
    const J = JUGADORES[YO];
    let conexion = null, ultimoVivo = null, empezo = false, terminado = false, cortada = false;
    let envio = 0, envioImg = 0, ultimoPuntaje = -1, ultimoNivel = null, enVuelo = 0, ultimaImg = "", ladoImagen = AJUSTES.ladoImagen;

    // Distintivo con el color del jugador, siempre visible.
    document.body.append(crear(`<div class="multi-yo" style="background:${J.color}"><b>${YO + 1}</b>${J.nombre}</div>`));
    // Capa de espera, con las reglas del juego.
    const reglas = document.querySelector("#inicio .reglas");
    const titulo = document.querySelector("#inicio h1");
    const capa = crear(`<section class="multi-capa multi-capa-cel">
      <div class="multi-panel">
        <div class="multi-yo-grande" style="background:${J.color}">${YO + 1}</div>
        <h2>${titulo ? titulo.innerHTML : esc(document.title)}</h2>
        ${reglas ? reglas.outerHTML : ""}
        <p class="multi-msg">Conectando con la pantalla…</p>
        <input class="multi-nombre-ini" type="text" maxlength="14" autocomplete="off" placeholder="Tu nombre (opcional)" aria-label="Tu nombre (opcional)" hidden>
        <button class="btn multi-listo" type="button" hidden>¡Estoy listo!</button>
      </div>
    </section>`);
    document.body.append(capa);
    const msg = capa.querySelector(".multi-msg"), btnListo = capa.querySelector(".multi-listo");
    const campoNombre = capa.querySelector(".multi-nombre-ini");
    let nombreYo = "";
    const panel = capa.querySelector(".multi-panel");
    if ($("inicio")) $("inicio").hidden = true;
    const btnPantalla = $("btn-pantalla"); if (btnPantalla) btnPantalla.hidden = true;

    function mostrarFinal(html) {
      capa.hidden = false;
      panel.innerHTML = `<div class="multi-yo-grande" style="background:${J.color}">${YO + 1}</div>${html}`;
    }

    async function unirse() {
      const motivo = O ? O.motivoNoDisponible() : "No se pudo cargar la conexión.";
      if (motivo) { msg.textContent = motivo; return; }
      try { conexion = await O.unirse(SALA, YO); } catch (e) { msg.textContent = e.message || String(e); return; }
      msg.innerHTML = `Eres el jugador <b>${YO + 1}</b> · ${J.nombre}.<br>Lee cómo se juega, escribe tu nombre para el ranking si quieres y confirma:`;
      btnListo.hidden = false; campoNombre.hidden = false;
      conexion.escuchar("vivo", (v) => {
        if (!v) { if (!empezo) msg.innerHTML = "<b>La partida terminó.</b><br>Para jugar otra, escanea un QR nuevo en la pantalla."; return; }
        const antes = ultimoVivo; ultimoVivo = v;
        if (v.fase === "jugar" && Number(v.lado) > 0) ladoImagen = Math.max(AJUSTES.ladoMin, Math.min(AJUSTES.ladoMax, Number(v.lado)));
        if (v.fase === "jugar" && (!antes || antes.fase !== "jugar")) cuentaRegresiva(v.semilla);
        if (v.fase === "jugar" && v.forzar && empezo && !terminado) { try { if (window.__forzarFin) window.__forzarFin(); } catch { /* el juego sigue */ } }
        if (v.fase === "podio") { if (!terminado) cortar(); puesto(v.podio, v); }
      });
    }

    btnListo.addEventListener("click", () => {
      if (!conexion) return;
      const n = campoNombre.value.trim().slice(0, 14);
      if (n) { nombreYo = n; conexion.marcar("nombres", n); }
      conexion.marcar("listos", true);
      btnListo.hidden = true; campoNombre.hidden = true; campoNombre.blur();
      msg.innerHTML = `<b class="multi-grande">✓ ¡Listo${nombreYo ? `, ${esc(nombreYo)}` : ""}!</b><br>Esperando a que los demás confirmen…`;
      try { navigator.vibrate && navigator.vibrate(30); } catch { /* no disponible */ }
    });

    async function cuentaRegresiva(semilla) {
      btnListo.hidden = true; campoNombre.hidden = true;
      for (const n of [3, 2, 1]) { msg.innerHTML = `<b class="multi-grande">${n}</b><br>¡Prepárate!`; await new Promise((ok) => setTimeout(ok, 800)); }
      if (cortada) return;
      sembrar(semilla);
      capa.hidden = true;
      empezo = true;
      $("btn-jugar").disabled = false;
      $("btn-jugar").click();
      // Puntaje e imagen de su pantalla, para la pantalla grande.
      envio = setInterval(tick, 1000 / AJUSTES.puntosPorSegundo);
      envioImg = window.__vivo
        ? setInterval(enviarDatos, 1000 / AJUSTES.datosPorSegundo)
        : setInterval(enviarImagen, 1000 / AJUSTES.imagenesPorSegundo);
    }

    const lienzo = document.querySelector("canvas");
    const mini = document.createElement("canvas"), sonda = document.createElement("canvas");
    /** Parte del lienzo con dibujo (el mapa), sin los márgenes del color de fondo. */
    function recorte() {
      const W = 90, H = Math.max(1, Math.round((lienzo.height / lienzo.width) * W));
      sonda.width = W; sonda.height = H;
      const g = sonda.getContext("2d", { willReadFrequently: true });
      g.drawImage(lienzo, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data, r0 = d[0], g0 = d[1], b0 = d[2];
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) return { x: 0, y: 0, w: lienzo.width, h: lienzo.height };
      const k = lienzo.width / W, borde = 2;
      const x = Math.max(0, (x0 - borde) * k), y = Math.max(0, (y0 - borde) * k);
      return { x, y, w: Math.min(lienzo.width, (x1 + 1 + borde) * k) - x, h: Math.min(lienzo.height, (y1 + 1 + borde) * k) - y };
    }
    const svgVivo = document.querySelector("svg[data-transmitir]");
    /** Imagen del SVG del juego (se dibuja en un canvas y se manda igual que la del lienzo). */
    function imagenSvg() {
      const vb = svgVivo.viewBox && svgVivo.viewBox.baseVal;
      const w0 = (vb && vb.width) || svgVivo.clientWidth, h0 = (vb && vb.height) || svgVivo.clientHeight;
      if (!w0 || !h0) return null;
      const e = ladoImagen / Math.max(w0, h0), w = Math.round(w0 * e), h = Math.round(h0 * e);
      const copia = svgVivo.cloneNode(true);
      copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      copia.setAttribute("width", w); copia.setAttribute("height", h);
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copia));
      return new Promise((ok) => {
        const img = new Image();
        img.onload = () => {
          mini.width = w; mini.height = h;
          const g = mini.getContext("2d");
          g.fillStyle = "#FBF6F6"; g.fillRect(0, 0, w, h);
          g.drawImage(img, 0, 0, w, h);
          try { ok(mini.toDataURL(formato(), AJUSTES.calidadImagen)); } catch { ok(null); }
        };
        img.onerror = () => ok(null);
        img.src = url;
      });
    }
    function imagen() {
      if ((!lienzo || !lienzo.width) && svgVivo) return imagenSvg();
      if (!lienzo || !lienzo.width) return null;
      let r;
      try { r = recorte(); } catch { r = { x: 0, y: 0, w: lienzo.width, h: lienzo.height }; }
      // sin agrandar más que el lienzo original (no gana nitidez, solo peso)
      const e = Math.min(1, ladoImagen / Math.max(r.w, r.h));
      const w = Math.max(1, Math.round(r.w * e)), h = Math.max(1, Math.round(r.h * e));
      mini.width = w; mini.height = h;
      const g = mini.getContext("2d");
      g.fillStyle = "#FBF6F6"; g.fillRect(0, 0, w, h);
      g.drawImage(lienzo, r.x, r.y, r.w, r.h, 0, 0, w, h);
      try { return mini.toDataURL(formato(), AJUSTES.calidadImagen); } catch { return null; }
    }
    /** WebP pesa menos que JPEG; se usa si el navegador lo genera (Safari no: ahí JPEG). */
    let formatoImg = null;
    function formato() {
      if (!formatoImg) {
        const c = document.createElement("canvas"); c.width = c.height = 2;
        formatoImg = c.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
      }
      return formatoImg;
    }
    /** Manda los datos de la partida (window.__vivo): el nivel una vez y el estado cuando cambia.
     *  Si hay envíos sin confirmar, se salta el cuadro para no acumular atraso. */
    let ultimaClave = null, ultimoEstado = "";
    function enviarDatos() {
      if (!conexion || terminado) return;
      let clave, s;
      try {
        clave = window.__vivo.clave();
        if (!clave) return;
        if (clave !== ultimaClave) {
          ultimaClave = clave; ultimoEstado = "";
          conexion.marcar("vivoNivel", JSON.stringify({ c: clave, d: window.__vivo.nivel() }));
        }
        if (enVuelo >= AJUSTES.imagenesEnVuelo) return;
        s = JSON.stringify({ c: clave, e: window.__vivo.estado() });
      } catch (e) { return; }
      if (s === ultimoEstado) return;
      ultimoEstado = s; enVuelo++;
      Promise.resolve().then(() => conexion.marcar("vivoEstado", s)).catch(() => {}).finally(() => { enVuelo--; });
    }

    /** Manda la imagen de la pantalla. Si hay envíos sin confirmar, se salta el cuadro:
     *  así la pantalla grande va al día en vez de ir mostrando cuadros atrasados. */
    function enviarImagen() {
      if (!conexion || terminado || enVuelo >= AJUSTES.imagenesEnVuelo) return;
      // Celular girado (iPhone no deja bloquearlo): la pantalla grande se queda con la última imagen vertical.
      if (O && O.girado && O.girado()) return;
      enVuelo++;
      Promise.resolve(imagen())
        .then((img) => {
          if (!img || img === ultimaImg || terminado) return;
          ultimaImg = img;
          return conexion.marcar("imagenes", img);
        })
        .catch(() => {}).finally(() => { enVuelo--; });
    }

    function tick() {
      if (!conexion || terminado) return;
      // El modo stand del juego vuelve al inicio tras un rato sin toques; en una partida
      // en línea no debe pasar (hay momentos en que solo se mira): se avisa que hay actividad.
      document.dispatchEvent(new KeyboardEvent("keydown"));
      const pts = puntosJuego();
      const nv = String(estado().nivel || "");
      if (pts !== ultimoPuntaje || nv !== ultimoNivel) { ultimoPuntaje = pts; ultimoNivel = nv; conexion.enviar({ tipo: "puntos", puntos: pts, nivel: nv }); }
      if (estado().fase === "final") terminar(false);
    }

    function terminar(porPantalla) {
      if (terminado) return;
      terminado = true;
      clearInterval(envio); clearInterval(envioImg);
      const pts = puntosJuego();
      if (conexion) conexion.enviar({ tipo: "fin", puntos: pts, delegado: !porPantalla && !!estado().delegado });
      const titular = (!porPantalla && $("fin-titular") && $("fin-titular").innerHTML.trim()) || "";
      const dato = (!porPantalla && $("fin-dato") && $("fin-dato").innerHTML.trim()) || PITCH.dato;
      mostrarFinal(`<h2>${porPantalla ? "Se terminó la partida" : "¡Terminaste!"}</h2>
        <div class="multi-grande">${fmt(pts)}</div><p class="multi-sub">puntos</p>
        <div class="multi-puesto"></div>
        <p class="multi-msg">${porPantalla ? "La partida se terminó desde la pantalla." : "Mira la pantalla grande: ahí está el marcador."}</p>
        <div class="multi-pitch">${titular ? `<p class="dato-tit">${titular}</p>` : ""}${dato ? `<p class="dato-txt">${dato}</p>` : ""}</div>`);
      if (ultimoVivo && ultimoVivo.fase === "podio") puesto(ultimoVivo.podio, ultimoVivo);
    }

    /** La pantalla terminó la partida: el juego queda tapado y ya no se puede seguir. */
    function cortar() {
      cortada = true;
      if (empezo) terminar(true);
      else { btnListo.hidden = true; msg.innerHTML = "<b>La partida terminó.</b><br>Para jugar otra, escanea un QR nuevo en la pantalla."; }
    }

    let nombreEnviado = false;
    function puesto(podio, v) {
      const k = (podio || []).findIndex((x) => x.p === YO), el = capa.querySelector(".multi-puesto");
      if (k < 0 || !el) return;
      const titulo = podio.length > 1 ? `<b>${k === 0 ? "¡Ganaste!" : `Quedaste ${k + 1}º de ${podio.length}`}</b>` : "<b>¡Bien jugado!</b>";
      const pide = v && v.pideNombre === YO;
      if (!pide) { el.innerHTML = titulo; return; }
      if (v.nombreOk || nombreYo) { el.innerHTML = `${titulo}<p class="multi-nombre-ok">✓ ${esc(v.nombreOk || nombreYo)} quedó en el ranking.</p>`; return; }
      if (el.querySelector(".multi-nombre")) return;
      el.innerHTML = `${titulo}<form class="multi-nombre">
        <label for="multi-nombre-campo">Escribe tu nombre para el ranking</label>
        <div><input id="multi-nombre-campo" maxlength="14" autocomplete="off" placeholder="Tu nombre" aria-label="Tu nombre" required>
        <button class="btn" type="submit">Guardar</button></div></form>`;
      const form = el.querySelector(".multi-nombre"), campo = form.querySelector("input");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const n = campo.value.trim().slice(0, 14);
        if (!n || nombreEnviado || !conexion) return;
        nombreEnviado = true;
        campo.disabled = true; form.querySelector("button").disabled = true;
        Promise.resolve(conexion.marcar("nombres", n)).catch(() => { nombreEnviado = false; campo.disabled = false; form.querySelector("button").disabled = false; });
      });
    }

    unirse();
  }

  if (ES_CELULAR) iniciarCelular(); else iniciarPantalla();
})();
