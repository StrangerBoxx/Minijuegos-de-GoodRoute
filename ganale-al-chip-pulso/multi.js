/* multi.js — "Jugar con celulares" para los minijuegos individuales de GoodRoute.
 *
 * Se agrega a un juego sin cambiar su lógica. El juego solo tiene que tener:
 *   - #inicio con #btn-jugar (empieza la partida) y .reglas;
 *   - window.__estadoJuego() con { fase, puntosTotal } (fase "final" = terminó).
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
    imagenesPorSegundo: 3,
    anchoImagen: 220,          // px de la imagen que manda cada celular
    calidadImagen: 0.55,
    segundosAutoInicio: 1.5,   // cuando todos confirmaron
  };
  const JUGADORES = [
    { nombre: "Azul", color: "#2f6fd6" }, { nombre: "Naranjo", color: "#E8772E" }, { nombre: "Verde", color: "#1f9d6b" },
    { nombre: "Morado", color: "#7c54c9" }, { nombre: "Rosa", color: "#c23b7a" }, { nombre: "Turquesa", color: "#0f8b8d" },
  ];
  const params = new URLSearchParams(location.search);
  const SALA = params.get("sala"), YO = Number(params.get("j")) - 1;
  const ES_CELULAR = !!(SALA && JUGADORES[YO]);

  const $ = (id) => document.getElementById(id);
  const estado = () => { try { return window.__estadoJuego ? window.__estadoJuego() : {}; } catch { return {}; } };
  const puntosJuego = () => Math.max(0, Math.round(Number(estado().puntosTotal) || 0));
  const fmt = (n) => Math.round(n).toLocaleString("es-CL");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const crear = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };

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
      btnJugar.textContent = nJug > 1 ? "Jugar en esta pantalla (1 jugador)" : textoJugar;
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
    </section>`);
    const capaPodio = crear(`<section class="multi-capa" hidden>
      <div class="multi-panel">
        <p class="multi-eyebrow">${esc(document.title.split("·")[0].trim())} · resultado</p>
        <h2 class="multi-podio-titulo"></h2>
        <ol class="multi-lista"></ol>
        <div class="multi-botones">
          <button class="btn multi-otra" type="button">Jugar de nuevo</button>
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
            `<span class="${preparados[p] ? "si" : ""}"><i style="background:${JUGADORES[p].color}">${p + 1}</i>${JUGADORES[p].nombre}${preparados[p] ? " ✓" : "…"}</span>`).join("")}</div>`
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
      jug.forEach((j) => { j.puntos = 0; j.listo = false; });
      capaSala.hidden = true; capaVivo.hidden = false;
      capaVivo.querySelector(".multi-cuadros").style.setProperty("--n", nJug);
      capaVivo.querySelector(".multi-cuadros").dataset.n = nJug;
      capaVivo.querySelector(".multi-cuadros").innerHTML = jug.map((_, p) => `<div class="multi-cuadro" data-p="${p}" style="--color:${JUGADORES[p].color}">
        <div class="multi-cuadro-cab"><b>${p + 1}</b><span>${JUGADORES[p].nombre}</span><em class="multi-pts">0 pts</em></div>
        <div class="multi-cuadro-cuerpo"><img alt="" hidden><p class="multi-espera">Esperando su partida…</p><p class="multi-termino" hidden>✓ Terminó</p></div>
      </div>`).join("");
      sala.publicar("vivo", { fase: "jugar", semilla });
      pintarVivo();
    }

    function recibir(m) {
      const p = Number(m.p), j = jug[p];
      if (!j || estadoSala !== "jugar") return;
      if (m.tipo === "puntos") j.puntos = Math.max(j.puntos, Math.round(m.puntos || 0));
      else if (m.tipo === "fin") { j.puntos = Math.max(0, Math.round(m.puntos || 0)); j.listo = true; }
      pintarVivo();
      if (jug.every((x) => x.listo || !x.conectado)) setTimeout(() => { if (estadoSala === "jugar") podio(); }, 1200);
    }

    function pintarVivo() {
      if (estadoSala !== "jugar") return;
      jug.forEach((j, p) => {
        const c = capaVivo.querySelector(`.multi-cuadro[data-p="${p}"]`);
        if (!c) return;
        c.querySelector(".multi-pts").textContent = `${fmt(j.puntos)} pts`;
        c.querySelector(".multi-termino").hidden = !j.listo;
        c.querySelector(".multi-espera").textContent = j.conectado ? "Esperando su partida…" : "Desconectado";
        c.classList.toggle("listo", j.listo);
      });
    }

    function podio() {
      if (estadoSala !== "jugar") return;
      estadoSala = "podio";
      const o = jug.map((j, p) => ({ ...j, p })).sort((a, b) => b.puntos - a.puntos || a.p - b.p);
      capaPodio.querySelector(".multi-podio-titulo").textContent = o.length > 1 ? `¡Gana ${JUGADORES[o[0].p].nombre}!` : "¡Terminó!";
      capaPodio.querySelector(".multi-lista").innerHTML = o.map((j, k) => `<li class="${k === 0 ? "primero" : ""}">
        <span class="pos">${k + 1}º</span><span class="num" style="background:${JUGADORES[j.p].color}">${j.p + 1}</span>
        <span class="quien">${JUGADORES[j.p].nombre}</span><span class="pts">${fmt(j.puntos)}</span></li>`).join("");
      capaVivo.querySelector(".multi-terminar").hidden = true;
      capaPodio.hidden = false;
      // El ganador queda en el ranking del juego (con el nombre de su color); la biblioteca muestra el récord.
      if (o[0] && o[0].puntos > 0) {
        try {
          const lista = JSON.parse(localStorage.getItem(CLAVE_RANKING)) || [];
          lista.push({ nombre: JUGADORES[o[0].p].nombre, puntos: o[0].puntos, t: Date.now() });
          localStorage.setItem(CLAVE_RANKING, JSON.stringify(lista.sort((a, b) => b.puntos - a.puntos || a.t - b.t).slice(0, 10)));
        } catch { /* sin almacenamiento */ }
      }
      sala.cerrar({ fase: "podio", podio: o.map((j) => ({ p: j.p, puntos: j.puntos })) });
      sala = null;
    }

    function cerrar() {
      clearTimeout(autoInicio);
      if (sala) sala.cerrar();
      sala = null; estadoSala = "";
      capaSala.hidden = true; capaVivo.hidden = true; capaPodio.hidden = true;
      capaVivo.querySelector(".multi-terminar").hidden = false;
    }

    btnCel.addEventListener("click", abrirSala);
    btnEmpezar.addEventListener("click", () => { if (estadoSala === "sala" && todosListos()) empezar(); });
    capaSala.querySelector(".multi-volver").addEventListener("click", () => { cerrar(); $("inicio").hidden = false; pintarNumeros(); });
    capaVivo.querySelector(".multi-terminar").addEventListener("click", podio);
    capaPodio.querySelector(".multi-otra").addEventListener("click", () => { cerrar(); $("inicio").hidden = false; pintarNumeros(); });

    window.__multi = { estado: () => ({ estadoSala, jug, preparados }), urlDe: (p) => (sala ? sala.urlControl(p) : null) };
  }

  // =====================================================================
  // Celular
  // =====================================================================
  function iniciarCelular() {
    const J = JUGADORES[YO];
    let conexion = null, ultimoVivo = null, empezo = false, terminado = false, cortada = false;
    let envio = 0, ultimoPuntaje = -1;

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
        <button class="btn multi-listo" type="button" hidden>¡Estoy listo!</button>
      </div>
    </section>`);
    document.body.append(capa);
    const msg = capa.querySelector(".multi-msg"), btnListo = capa.querySelector(".multi-listo");
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
      msg.innerHTML = `Eres el jugador <b>${YO + 1}</b> · ${J.nombre}.<br>Lee cómo se juega y, cuando estés preparado, confirma:`;
      btnListo.hidden = false;
      conexion.escuchar("vivo", (v) => {
        if (!v) { if (!empezo) msg.innerHTML = "<b>La partida terminó.</b><br>Para jugar otra, escanea un QR nuevo en la pantalla."; return; }
        const antes = ultimoVivo; ultimoVivo = v;
        if (v.fase === "jugar" && (!antes || antes.fase !== "jugar")) cuentaRegresiva(v.semilla);
        if (v.fase === "podio") { if (!terminado) cortar(); puesto(v.podio); }
      });
    }

    btnListo.addEventListener("click", () => {
      if (!conexion) return;
      conexion.marcar("listos", true);
      btnListo.hidden = true;
      msg.innerHTML = `<b class="multi-grande">✓ ¡Listo!</b><br>Esperando a que los demás confirmen…`;
      try { navigator.vibrate && navigator.vibrate(30); } catch { /* no disponible */ }
    });

    async function cuentaRegresiva(semilla) {
      btnListo.hidden = true;
      for (const n of [3, 2, 1]) { msg.innerHTML = `<b class="multi-grande">${n}</b><br>¡Prepárate!`; await new Promise((ok) => setTimeout(ok, 800)); }
      if (cortada) return;
      sembrar(semilla);
      capa.hidden = true;
      empezo = true;
      $("btn-jugar").disabled = false;
      $("btn-jugar").click();
      // Puntaje e imagen de su pantalla, para la pantalla grande.
      envio = setInterval(tick, 1000 / AJUSTES.imagenesPorSegundo);
    }

    const lienzo = document.querySelector("canvas");
    const mini = document.createElement("canvas");
    function imagen() {
      if (!lienzo || !lienzo.width) return null;
      const w = AJUSTES.anchoImagen, h = Math.round((lienzo.height / lienzo.width) * w);
      mini.width = w; mini.height = h;
      const g = mini.getContext("2d");
      g.fillStyle = "#FBF6F6"; g.fillRect(0, 0, w, h);
      g.drawImage(lienzo, 0, 0, w, h);
      try { return mini.toDataURL("image/jpeg", AJUSTES.calidadImagen); } catch { return null; }
    }

    function tick() {
      if (!conexion || terminado) return;
      // El modo stand del juego vuelve al inicio tras un rato sin toques; en una partida
      // en línea no debe pasar (hay momentos en que solo se mira): se avisa que hay actividad.
      document.dispatchEvent(new KeyboardEvent("keydown"));
      const pts = puntosJuego();
      if (pts !== ultimoPuntaje) { ultimoPuntaje = pts; conexion.enviar({ tipo: "puntos", puntos: pts }); }
      const img = imagen();
      if (img) conexion.marcar("imagenes", img);
      if (estado().fase === "final") terminar(false);
    }

    function terminar(porPantalla) {
      if (terminado) return;
      terminado = true;
      clearInterval(envio);
      const pts = puntosJuego();
      if (conexion) conexion.enviar({ tipo: "fin", puntos: pts });
      mostrarFinal(`<h2>${porPantalla ? "Se terminó la partida" : "¡Terminaste!"}</h2>
        <div class="multi-grande">${fmt(pts)}</div><p class="multi-sub">puntos</p>
        <p class="multi-msg">${porPantalla ? "La partida se terminó desde la pantalla." : "Mira la pantalla grande: ahí está el marcador."}</p>
        <p class="multi-puesto"></p>`);
      if (ultimoVivo && ultimoVivo.fase === "podio") puesto(ultimoVivo.podio);
    }

    /** La pantalla terminó la partida: el juego queda tapado y ya no se puede seguir. */
    function cortar() {
      cortada = true;
      if (empezo) terminar(true);
      else { btnListo.hidden = true; msg.innerHTML = "<b>La partida terminó.</b><br>Para jugar otra, escanea un QR nuevo en la pantalla."; }
    }

    function puesto(podio) {
      const k = (podio || []).findIndex((x) => x.p === YO), el = capa.querySelector(".multi-puesto");
      if (k < 0 || !el) return;
      el.innerHTML = podio.length > 1 ? `<b>${k === 0 ? "¡Ganaste!" : `Quedaste ${k + 1}º de ${podio.length}`}</b>` : "<b>¡Bien jugado!</b>";
    }

    unirse();
  }

  if (ES_CELULAR) iniciarCelular(); else iniciarPantalla();
})();
