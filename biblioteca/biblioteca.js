/* biblioteca.js — biblioteca de minijuegos de GoodRoute (Control Position).
 *
 * Muestra el catálogo (biblioteca/juegos.js) como tarjetas, separadas en
 * pestañas por modo (individuales o grupales), con el récord de cada juego y
 * un botón que sortea uno de la pestaña abierta. Al elegir uno, lo abre dentro de la misma página
 * con una barra para volver. Los juegos no se modifican: cada carpeta sigue
 * funcionando sola.
 *
 * La dirección guarda el juego abierto (#reparto), así que se puede dejar
 * un juego fijo en el stand abriendo index.html#reparto.
 */
(() => {
  "use strict";

  const AJUSTES = {
    // Si nadie toca la pantalla por este tiempo dentro de un juego, se vuelve a
    // la biblioteca. 0 = nunca. Funciona cuando se sirve por http(s) (por
    // ejemplo GitHub Pages o Live Server); abriendo el archivo directo, el
    // navegador no deja ver los toques dentro del juego y queda desactivado.
    volverTrasInactividadMs: 120000,
    ocultarControlesMs: 2500,
    version: "20261114a",
    claveFiltro: "biblioteca.filtro",
    claveControl: "biblioteca.control",
  };

  const { tipos, controles = {} } = window.CATALOGO;
  // Los juegos con "oculto: true" en el catálogo no aparecen (ni se abren por dirección).
  const juegos = window.CATALOGO.juegos.filter((j) => !j.oculto);
  const ICONO_CONTROL = {
    mouse: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v6" stroke="currentColor" stroke-width="2"/></svg>',
    tactil: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 18h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const $ = (id) => document.getElementById(id);
  const ui = {
    biblioteca: $("biblioteca"), filtros: $("filtros"), grilla: $("grilla"),
    sala: $("sala"), marco: $("marco"), barraTitulo: $("barra-titulo"),
    btnAzar: $("btn-azar"), btnAzarTexto: $("btn-azar-texto"),
    barraSub: $("barra-subfiltros"), subfiltros: $("subfiltros"), subDetalle: $("subfiltro-detalle"),
  };
  const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Siempre hay una pestaña elegida (no hay "Todos"): la primera del catálogo por defecto.
  const primerTipo = Object.keys(tipos)[0];
  let filtro = primerTipo;
  try { filtro = localStorage.getItem(AJUSTES.claveFiltro) || primerTipo; } catch { /* sin almacenamiento */ }
  if (!tipos[filtro]) filtro = primerTipo;
  // Sub-filtro: cómo se juega (mouse o táctil). Por defecto, mouse.
  let control = Object.keys(controles)[0];
  try { control = localStorage.getItem(AJUSTES.claveControl) || control; } catch { /* sin almacenamiento */ }
  if (!controles[control]) control = Object.keys(controles)[0];

  // ---------- Récords (cada juego guarda su ranking en "<carpeta>.ranking") ----------
  function record(carpeta) {
    try {
      const lista = JSON.parse(localStorage.getItem(carpeta + ".ranking")) || [];
      return lista.length ? lista[0] : null;
    } catch { return null; }
  }

  // ---------- Biblioteca ----------
  // Sin pestañas Individuales / Grupales: todos los juegos visibles van en una sola grilla.
  function pintarFiltros() {
    ui.filtros.innerHTML = "";
    ui.filtros.hidden = true;
  }

  /** Controles presentes en la pestaña abierta. Con más de uno, aparece el sub-filtro. */
  const controlesDe = () => Object.keys(controles).filter((c) => juegos.some((j) => j.control === c));

  function pintarSubfiltros() {
    const presentes = controlesDe(filtro);
    ui.barraSub.hidden = presentes.length < 2;
    if (ui.barraSub.hidden) return;
    if (!presentes.includes(control)) control = presentes[0];
    const cuenta = (c) => juegos.filter((j) => j.control === c).length;
    ui.subfiltros.innerHTML = presentes.map((c) =>
      `<button class="subfiltro subfiltro-${c}" type="button" data-control="${c}" aria-pressed="${c === control}">` +
      `${ICONO_CONTROL[c] ?? ""}${escapar(controles[c].nombre)}<b>${cuenta(c)}</b></button>`).join("");
    ui.subDetalle.textContent = controles[control].detalle ?? "";
  }

  function pintarGrilla() {
    pintarSubfiltros();
    const conSub = !ui.barraSub.hidden;
    const visibles = juegos.filter((j) => !conSub || j.control === control);
    ui.btnAzar.hidden = visibles.length < 2;
    ui.btnAzarTexto.textContent = conSub ? `Juego al azar · ${controles[control].nombre.toLowerCase()}` : "Juego al azar";
    ui.grilla.style.setProperty("--columnas", Math.max(1, visibles.length));
    ui.grilla.innerHTML = visibles.length
      ? visibles.map((j) => tarjeta(j, record(j.carpeta))).join("")
      : `<p class="vacio">No hay juegos todavía.</p>`;
  }

  function tarjeta(j, r) {
      return `<a class="tarjeta juego" href="#${encodeURIComponent(j.carpeta)}" aria-label="Jugar ${escapar(j.nombre)}">
        <div class="tarjeta-portada">
          <img src="biblioteca/miniaturas/${encodeURIComponent(j.carpeta)}.jpg" alt="" onerror="this.remove()" />
          ${j.nuevo ? '<span class="nuevo">Nuevo</span>' : ""}
        </div>
        <div class="tarjeta-cuerpo">
          <h2>${escapar(j.nombre)}</h2>
          <p class="muestra">${escapar(j.muestra)}</p>
          <p class="frase">${escapar(j.frase)}</p>
          <div class="datos">
            <span class="duracion">${escapar(j.duracion)} · ${escapar(j.rondas)}</span>
            ${r ? `<span class="record"><small>Récord</small>${Math.round(r.puntos).toLocaleString("es-CL")}${r.nombre ? ` · ${escapar(r.nombre)}` : ""}</span>` : '<span class="record sin">Sin récord aún</span>'}
          </div>
          <span class="btn-jugar">Jugar</span>
        </div>
      </a>`;
  }

  ui.filtros.addEventListener("click", (e) => {
    const b = e.target.closest(".filtro");
    if (!b || sorteando) return;
    filtro = b.dataset.filtro;
    try { localStorage.setItem(AJUSTES.claveFiltro, filtro); } catch { /* sin almacenamiento */ }
    pintarFiltros(); pintarGrilla();
  });

  ui.subfiltros.addEventListener("click", (e) => {
    const b = e.target.closest(".subfiltro");
    if (!b || sorteando) return;
    control = b.dataset.control;
    try { localStorage.setItem(AJUSTES.claveControl, control); } catch { /* sin almacenamiento */ }
    pintarGrilla();
  });

  // ---------- Juego al azar ----------
  // Una "ruleta" recorre las tarjetas de la pestaña abierta, cada vez más lento,
  // se detiene en una y la abre.
  let sorteando = false;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const pocoMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function sortear() {
    if (sorteando) return;
    const tarjetas = [...ui.grilla.querySelectorAll(".juego")];
    if (tarjetas.length < 2) return;
    sorteando = true;
    ui.btnAzar.disabled = true; ui.btnAzar.classList.add("girando");
    ui.grilla.classList.add("sorteando");

    const elegida = Math.floor(Math.random() * tarjetas.length);
    // Pasos: unas vueltas completas y terminar justo en la elegida.
    const vueltas = pocoMovimiento() ? 0 : Math.max(2, Math.ceil(14 / tarjetas.length));
    const pasos = vueltas * tarjetas.length + elegida + 1;
    let i = Math.floor(Math.random() * tarjetas.length);
    for (let k = 0; k < pasos; k++) {
      tarjetas.forEach((t) => t.classList.remove("resaltado"));
      i = (i + 1) % tarjetas.length;
      tarjetas[i].classList.add("resaltado");
      const avance = k / Math.max(1, pasos - 1);              // 0 → 1
      await esperar(pocoMovimiento() ? 150 : 70 + 330 * avance * avance);   // frena al final
    }
    tarjetas.forEach((t) => t.classList.remove("resaltado"));
    tarjetas[i].classList.add("elegido");
    await esperar(1100);

    ui.btnAzar.disabled = false; ui.btnAzar.classList.remove("girando");
    ui.grilla.classList.remove("sorteando");
    sorteando = false;
    location.hash = tarjetas[i].getAttribute("href").slice(1);  // abre el juego (y deja la dirección como siempre)
  }
  ui.btnAzar.addEventListener("click", sortear);
  // Mientras gira la ruleta, tocar una tarjeta no la abre.
  ui.grilla.addEventListener("click", (e) => { if (sorteando) e.preventDefault(); });

  // ---------- Abrir y cerrar juegos (según la dirección: #carpeta) ----------
  let abierto = null, ultimoToque = Date.now();

  function abrir(j) {
    if (abierto === j) return;
    abierto = j;
    ui.barraTitulo.textContent = j.nombre;
    document.title = `${j.nombre} · Minijuegos GoodRoute`;
    const src = j.url || `${j.carpeta}/index.html`;
    nuevoMarco(`${src}${src.includes("?") ? "&" : "?"}v=${AJUSTES.version}`);
    ui.sala.hidden = false; ui.biblioteca.hidden = true;
    document.body.classList.add("jugando");
    ultimoToque = Date.now();
  }

  function cerrar() {
    if (!abierto) return;
    const carpeta = abierto.carpeta;
    abierto = null;
    nuevoMarco(null);                              // detiene el juego (bucle, temporizadores)
    ui.sala.hidden = true; ui.biblioteca.hidden = false;
    document.body.classList.remove("jugando");
    document.title = "Minijuegos GoodRoute";
    pintarGrilla();                                // por si hay récord nuevo
    ui.grilla.querySelector(`[href="#${CSS.escape(encodeURIComponent(carpeta))}"]`)?.focus({ preventScroll: false });
  }

  function seguirDireccion() {
    const carpeta = decodeURIComponent(location.hash.slice(1));
    const j = juegos.find((x) => x.carpeta === carpeta);
    if (j) { window.Marcador.ocultar(); abrir(j); return; }
    cerrar();
    const enRanking = carpeta === "ranking";
    ui.biblioteca.hidden = enRanking;
    if (enRanking) window.Marcador.mostrar(); else window.Marcador.ocultar();
    document.title = enRanking ? "Ranking · Minijuegos GoodRoute" : "Minijuegos GoodRoute";
    mostrarControles();
  }
  addEventListener("hashchange", seguirDireccion);

  // Volver: limpia la dirección y muestra la biblioteca (el botón "atrás" del navegador también funciona).
  $("volver").addEventListener("click", (e) => {
    e.preventDefault();
    history.replaceState(null, "", location.pathname + location.search);
    seguirDireccion();
  });

  // ---------- Pantalla completa (de toda la biblioteca, para que la barra siga visible) ----------
  const alternarPantalla = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  $("barra-pantalla").addEventListener("click", alternarPantalla);
  $("btn-pantalla-lib").addEventListener("click", alternarPantalla);
  $("btn-pantalla-mc").addEventListener("click", alternarPantalla);

  const ajustar = () => document.documentElement.style.setProperty("--k", Math.min(innerWidth / 1920, innerHeight / 1080));
  addEventListener("resize", ajustar);

  function conexion() {
    const en = navigator.onLine !== false;
    for (const v of document.querySelectorAll(".vivo")) {
      v.classList.toggle("sin-conexion", !en);
      v.title = en ? "Con conexión" : "Sin conexión";
      v.setAttribute("aria-label", v.title);
    }
  }
  addEventListener("online", conexion);
  addEventListener("offline", conexion);

  let controlesT = 0;
  function mostrarControles() {
    document.body.classList.remove("quieto");
    clearTimeout(controlesT);
    controlesT = setTimeout(() => document.body.classList.add("quieto"), AJUSTES.ocultarControlesMs);
  }
  addEventListener("pointermove", mostrarControles);
  addEventListener("pointerdown", mostrarControles);

  $("btn-a-ranking").addEventListener("click", () => { location.hash = "ranking"; });
  $("btn-a-juegos").addEventListener("click", () => {
    history.replaceState(null, "", location.pathname + location.search);
    seguirDireccion();
  });

  // ---------- Reiniciar récords ----------
  // Borra los rankings y récords de todos los juegos (también los ocultos) guardados en
  // este navegador: las claves "<juego>.ranking" y los récords de los minijuegos de ruta.
  $("btn-reiniciar").addEventListener("click", () => {
    const pasos = [
      "¿Borrar los récords y rankings de todos los juegos?",
      "Se borrarán todos los nombres y puntajes guardados en este equipo. ¿Seguir?",
      "Esto no se puede deshacer. ¿Seguro?",
      "Última confirmación: ¿borrar todo ahora?",
    ];
    for (const [i, texto] of pasos.entries()) {
      if (!confirm(`(${i + 1}/${pasos.length}) ${texto}`)) return;
    }
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.endsWith(".ranking") || k === "goodroute.minijuegos.records" || k === "flota-en-vivo.total") localStorage.removeItem(k);
      }
    } catch { /* sin almacenamiento */ }
    pintarGrilla();
    window.Marcador.pintar(true);
  });

  // ---------- Marco del juego ----------
  // Se crea un iframe nuevo por juego: cambiar el src de uno existente agrega
  // pasos al historial y el botón "atrás" retrocedería dentro del marco.
  function nuevoMarco(src) {
    const m = document.createElement("iframe");
    m.id = "marco"; m.title = "Minijuego"; m.allow = "fullscreen";
    if (src) m.src = src;
    m.addEventListener("load", escucharMarco);
    ui.marco.replaceWith(m);
    ui.marco = m;
  }

  // ---------- Vuelta a la biblioteca por inactividad ----------
  function escucharMarco() {
    try {
      const doc = ui.marco.contentDocument;          // falla si el navegador no deja (archivo local)
      if (!doc) return;
      // Dentro de la biblioteca manda el ⛶ de la barra: el del juego dejaría la barra fuera de la pantalla completa.
      const propio = doc.getElementById("btn-pantalla");
      if (propio) propio.hidden = true;
      for (const ev of ["pointerdown", "keydown"]) doc.addEventListener(ev, () => { ultimoToque = Date.now(); }, true);
    } catch { /* sin acceso: no se mide la inactividad dentro del juego */ }
  }
  for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { ultimoToque = Date.now(); }, true);
  setInterval(() => {
    if (!abierto || !AJUSTES.volverTrasInactividadMs) return;
    let medible = false;
    try { medible = !!ui.marco.contentDocument; } catch { medible = false; }
    if (medible && Date.now() - ultimoToque > AJUSTES.volverTrasInactividadMs) $("volver").click();
  }, 1000);

  // Los récords cambian cuando un juego guarda un puntaje (en otra pestaña o al volver).
  addEventListener("storage", (e) => { if (!abierto && e.key && e.key.endsWith(".ranking")) pintarGrilla(); });

  ajustar();
  conexion();
  pintarFiltros();
  pintarGrilla();
  seguirDireccion();
})();
