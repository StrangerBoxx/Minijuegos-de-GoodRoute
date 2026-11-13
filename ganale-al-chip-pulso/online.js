/* online.js — jugar con celulares (QR) en los juegos táctiles de GoodRoute.
 *
 * La pantalla del stand crea una "sala" y muestra un QR por color. Cada persona
 * escanea el suyo y abre control.html en su celular, que queda unido a la sala
 * con ese color y número. La pantalla manda el estado del juego y recibe las
 * jugadas de cada celular.
 *
 * Conexión:
 * - Firebase Realtime Database, con la configuración de ../firebase-config.js.
 * - Modo prueba (?prueba=1 en la dirección): conecta pestañas del mismo
 *   navegador, sin internet ni Firebase. Sirve para probar.
 *
 * Datos en la base, por sala:  salas/<CÓDIGO>/
 *   juego, nJug, creada        lo escribe la pantalla al crearla
 *   ronda                      datos fijos de la ronda (ciudad, clientes…)
 *   vivo                       estado que cambia (fase, reloj, jugadas…)
 *   jugadores/<p>              un celular conectado en el puesto p (0, 1, 2, 3)
 *   entradas/<id>              jugadas de los celulares; la pantalla las procesa y borra
 *
 * Este archivo es igual en las carpetas de los juegos que lo usan.
 */
(() => {
  "use strict";
  const O = {};
  const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  const QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  const HORAS_SALA = 6;           // las salas más viejas que esto se borran al crear una nueva

  const params = new URLSearchParams(location.search);
  O.prueba = params.has("prueba");

  /** ¿Se puede jugar con celulares? Si no, devuelve el motivo. */
  O.motivoNoDisponible = () => {
    if (O.prueba) return null;
    if (location.protocol === "file:") return "Abre los juegos desde su página web (por ejemplo GitHub Pages) para jugar con celulares.";
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL) return "Falta configurar Firebase (firebase-config.js).";
    return null;
  };
  O.disponible = () => !O.motivoNoDisponible();

  const cargarScript = (src) => new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  });
  const copia = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

  // ---------- Conexión: Firebase ----------
  async function conexionFirebase() {
    if (!window.firebase) {
      await cargarScript(FIREBASE_SDK + "firebase-app-compat.js");
      await cargarScript(FIREBASE_SDK + "firebase-database-compat.js");
    }
    const fb = window.firebase;
    const app = fb.apps.length ? fb.app() : fb.initializeApp(window.FIREBASE_CONFIG);
    const db = app.database();
    return {
      set: (ruta, v) => db.ref(ruta).set(v),
      remove: (ruta) => db.ref(ruta).remove(),
      push: (ruta, v) => db.ref(ruta).push(v),
      get: async (ruta) => (await db.ref(ruta).get()).val(),
      alValor: (ruta, cb) => { const r = db.ref(ruta), f = (s) => cb(s.val()); r.on("value", f); return () => r.off("value", f); },
      alAgregar: (ruta, cb) => { const r = db.ref(ruta), f = (s) => cb(s.key, s.val()); r.on("child_added", f); return () => r.off("child_added", f); },
      /**
       * Toma "ruta" para v.id solo si está libre o ya era suya (transacción: si dos
       * celulares lo intentan a la vez, gana uno solo). Devuelve true si la tomó.
       */
      reclamar: async (ruta, v) => {
        const r = await db.ref(ruta).transaction((actual) => (actual && actual.id && actual.id !== v.id ? undefined : v));
        return r.committed;
      },
      /**
       * Marca presencia en "ruta" mientras haya conexión. Si se corta y vuelve, la
       * reclama de nuevo; si en ese rato la tomó otro, llama alPerder().
       */
      presencia: (ruta, v, alPerder) => {
        const info = db.ref(".info/connected");
        const f = async (s) => {
          if (!s.val()) return;
          const r = await db.ref(ruta).transaction((actual) => (actual && actual.id && actual.id !== v.id ? undefined : v));
          if (r.committed) db.ref(ruta).onDisconnect().remove();
          else if (alPerder) alPerder();
        };
        info.on("value", f);
        return () => { info.off("value", f); db.ref(ruta).onDisconnect().cancel(); db.ref(ruta).remove(); };
      },
      hora: () => Date.now(),
    };
  }

  // ---------- Conexión: prueba entre pestañas del mismo navegador ----------
  function conexionPrueba() {
    const canal = new BroadcastChannel("minijuegos-goodroute-prueba");
    const yo = Math.random().toString(36).slice(2);
    let arbol = {};
    const subs = new Set();
    const partes = (r) => r.split("/").filter(Boolean);
    const leer = (r) => partes(r).reduce((o, k) => (o == null ? undefined : o[k]), arbol);
    const escribir = (r, v) => {
      const ps = partes(r);
      let o = arbol;
      for (const k of ps.slice(0, -1)) { if (typeof o[k] !== "object" || o[k] === null) o[k] = {}; o = o[k]; }
      if (v === null || v === undefined) delete o[ps[ps.length - 1]]; else o[ps[ps.length - 1]] = copia(v);
    };
    const avisar = () => subs.forEach((s) => s());
    canal.onmessage = (e) => {
      const m = e.data;
      if (m.t === "pedir") canal.postMessage({ t: "arbol", para: m.de, v: arbol });
      else if (m.t === "arbol") { if (m.para === yo) { arbol = m.v; avisar(); } }
      else if (m.t === "set") { escribir(m.r, m.v); avisar(); }
    };
    canal.postMessage({ t: "pedir", de: yo });
    const enviar = (r, v) => { escribir(r, v); canal.postMessage({ t: "set", r, v: copia(v) }); avisar(); return Promise.resolve(); };
    let n = 0;
    return {
      set: enviar,
      remove: (r) => enviar(r, null),
      push: (r, v) => enviar(`${r}/${Date.now().toString(36)}${(n++).toString(36).padStart(3, "0")}${yo.slice(0, 3)}`, v),
      get: async (r) => { await new Promise((ok) => setTimeout(ok, 200)); return copia(leer(r)); },
      alValor: (r, cb) => {
        let antes;
        const s = () => { const j = JSON.stringify(leer(r) ?? null); if (j !== antes) { antes = j; cb(JSON.parse(j)); } };
        subs.add(s); s();
        return () => subs.delete(s);
      },
      alAgregar: (r, cb) => {
        const vistos = new Set();
        const s = () => { const v = leer(r) || {}; for (const k of Object.keys(v).sort()) if (!vistos.has(k)) { vistos.add(k); cb(k, copia(v[k])); } };
        subs.add(s); s();
        return () => subs.delete(s);
      },
      reclamar: async (r, v) => {
        await new Promise((ok) => setTimeout(ok, 200));      // esperar el estado de las otras pestañas
        const actual = leer(r);
        if (actual && actual.id && actual.id !== v.id) return false;
        enviar(r, v);
        return true;
      },
      presencia: (r, v) => {
        enviar(r, v);
        const fuera = () => canal.postMessage({ t: "set", r, v: null });
        addEventListener("pagehide", fuera);
        return () => { removeEventListener("pagehide", fuera); enviar(r, null); };
      },
      hora: () => Date.now(),
    };
  }

  let conexion = null;
  O.conectar = async () => (conexion ??= O.prueba ? conexionPrueba() : await conexionFirebase());

  const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  /**
   * QR con el estilo de GoodRoute: puntos redondos azules, esquinas redondeadas con
   * centro naranjo y el logo al medio (qr-logo.png, junto a la página). Usa corrección
   * de errores Q (25 %) para que se lea aunque el logo tape el centro.
   */
  function qrGoodRoute(texto) {
    const q = window.qrcode(0, "Q"); q.addData(texto); q.make();
    const n = q.getModuleCount(), m = 2, T = n + m * 2;
    const AZUL = "#0B2545", NARANJO = "#E8772E";
    const esOjo = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const centro = n / 2, radioLogo = n * 0.13;
    let puntos = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!q.isDark(r, c) || esOjo(r, c)) continue;
      if (Math.hypot(c + 0.5 - centro, r + 0.5 - centro) < radioLogo + 0.8) continue;   // espacio del logo
      puntos += `<circle cx="${c + m + 0.5}" cy="${r + m + 0.5}" r="0.42"/>`;
    }
    const ojo = (r, c) =>
      `<rect x="${c + m + 0.5}" y="${r + m + 0.5}" width="6" height="6" rx="1.9" fill="none" stroke="${AZUL}" stroke-width="1"/>` +
      `<rect x="${c + m + 2}" y="${r + m + 2}" width="3" height="3" rx="0.85" fill="${NARANJO}"/>`;
    const lx = m + centro - radioLogo;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" role="img" aria-label="Código QR">` +
      `<rect width="${T}" height="${T}" fill="#fff"/><g fill="${AZUL}">${puntos}</g>` +
      ojo(0, 0) + ojo(0, n - 7) + ojo(n - 7, 0) +
      `<circle cx="${m + centro}" cy="${m + centro}" r="${radioLogo + 0.3}" fill="#fff"/>` +
      `<image href="qr-logo.png" x="${lx}" y="${lx}" width="${radioLogo * 2}" height="${radioLogo * 2}"/></svg>`;
  }
  const nuevoCodigo = () => Array.from({ length: 5 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join("");

  /** Avisa al modo stand (y a la biblioteca) que hay gente jugando, aunque nadie toque esta pantalla. */
  O.actividad = () => document.dispatchEvent(new KeyboardEvent("keydown"));

  // ---------- Pantalla del stand ----------
  /**
   * Crea una sala para nJug jugadores. Devuelve las funciones para manejarla.
   * opciones.control: página que abre el celular (por defecto control.html).
   */
  O.crearSala = async (juego, nJug, opciones = {}) => {
    const b = await O.conectar();
    // Limpieza: salas abandonadas de hace horas.
    try {
      const salas = (await b.get("salas")) || {};
      const limite = Date.now() - HORAS_SALA * 3600e3;
      for (const [c, s] of Object.entries(salas)) if (!s || !s.creada || s.creada < limite) b.remove(`salas/${c}`);
    } catch { /* sin permiso para leer todas: no importa */ }
    const codigo = nuevoCodigo(), raiz = `salas/${codigo}`;
    await b.set(raiz, { juego, nJug, creada: b.hora(), vivo: { fase: "sala" } });
    const quitar = [];
    let cerrada = false;
    return {
      codigo,
      /** Dirección que abre el celular del jugador p (0…3). */
      urlControl: (p) => {
        const u = new URL(opciones.control || "control.html", location.href);
        u.hash = "";
        u.pathname = u.pathname.replace(/\/index\.html$/, "/");   // dirección más corta = QR menos denso
        u.searchParams.set("sala", codigo);
        u.searchParams.set("j", String(p + 1));
        if (O.prueba) u.searchParams.set("prueba", "1");
        return u.href;
      },
      /** cb({ "0": {...}, "2": {...} }) cada vez que se conecta o desconecta un celular. */
      alJugadores: (cb) => quitar.push(b.alValor(`${raiz}/jugadores`, (v) => { O.actividad(); cb(v || {}); })),
      /** cb(jugada) por cada jugada de un celular; jugada.p es el puesto (0…3). */
      alEntrada: (cb) => quitar.push(b.alAgregar(`${raiz}/entradas`, (k, v) => {
        b.remove(`${raiz}/entradas/${k}`);
        if (v && !cerrada) { O.actividad(); cb(v); }
      })),
      publicar: (ruta, v) => (cerrada ? Promise.resolve() : b.set(`${raiz}/${ruta}`, v)),
      /** cb(valor) cada vez que cambia salas/<código>/<ruta> (por ejemplo, lo que escriben los celulares). */
      alValor: (ruta, cb) => quitar.push(b.alValor(`${raiz}/${ruta}`, (v) => { if (!cerrada) cb(v); })),
      cerrar: async (vivoFinal) => {
        if (cerrada) return;
        if (vivoFinal) await b.set(`${raiz}/vivo`, vivoFinal);
        cerrada = true;
        quitar.forEach((f) => f());
        // Se deja un rato para que los celulares alcancen a ver el resultado.
        setTimeout(() => b.remove(raiz), 60000);
      },
    };
  };

  /**
   * Sala de espera: muestra UN QR a la vez, el del primer jugador que falta
   * (1, luego 2…). Arriba, una fila con todos los colores marca quién ya entró.
   * Devuelve actualizar(conectados).
   */
  O.pintarSala = async (contenedor, sala, jugadores) => {
    if (!window.qrcode) await cargarScript(QR_LIB);
    const qr = (p) => qrGoodRoute(sala.urlControl(p));
    contenedor.innerHTML = `
      <div class="qr-progreso">${jugadores.map((j, p) =>
        `<span class="qr-paso" data-p="${p}" style="--color:${j.color}"><span class="qr-num">${p + 1}</span>${j.nombre}<b class="qr-check"></b></span>`).join("")}</div>
      ${jugadores.map((j, p) => `<div class="qr-tarjeta" data-p="${p}" style="--color:${j.color}" hidden>
        <div class="qr-cab">Turno de <span class="qr-num">${p + 1}</span>${j.nombre}</div>
        <div class="qr-img">${qr(p)}</div>
        <div class="qr-estado">Escanea con tu celular</div>
      </div>`).join("")}
      <div class="qr-listos" hidden>¡Están todos conectados!</div>`;
    return (conectados) => {
      const falta = jugadores.findIndex((_, p) => !conectados[p]);
      for (const el of contenedor.querySelectorAll(".qr-paso")) {
        const p = Number(el.dataset.p), ok = !!conectados[p];
        el.classList.toggle("conectado", ok);
        el.classList.toggle("actual", p === falta);
        el.querySelector(".qr-check").textContent = ok ? "✓" : "";
      }
      for (const el of contenedor.querySelectorAll(".qr-tarjeta")) el.hidden = Number(el.dataset.p) !== falta;
      contenedor.querySelector(".qr-listos").hidden = falta !== -1;
    };
  };

  // ---------- Celular ----------
  /** Identificador de este celular (de esta pestaña): sobrevive a recargar la página. */
  function idCliente() {
    try {
      let id = sessionStorage.getItem("minijuegos.cliente");
      if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("minijuegos.cliente", id); }
      return id;
    } catch { return Math.random().toString(36).slice(2); }
  }

  const OCUPADO = "Este jugador ya está ocupado: otra persona escaneó este QR antes. Espera tu turno y escanea el QR que aparece ahora en la pantalla.";

  /** Aviso a pantalla completa cuando otro celular se quedó con el puesto. */
  function avisoPuestoPerdido() {
    if (document.getElementById("puesto-perdido")) return;
    const d = document.createElement("div");
    d.id = "puesto-perdido";
    d.style.cssText = "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:rgba(11,37,69,.92);color:#fff;font:600 18px/1.45 system-ui,sans-serif;text-align:center";
    d.innerHTML = "<div><div style=\"font-size:44px\">⚠️</div><p>Otro celular se quedó con este jugador mientras estabas sin conexión.</p><p>Escanea el QR que aparece ahora en la pantalla.</p></div>";
    document.body.append(d);
  }

  /** Une este celular a la sala en el puesto p. Lanza un error con mensaje si no se puede. */
  O.unirse = async (codigo, p) => {
    const b = await O.conectar();
    const raiz = `salas/${codigo}`;
    const juego = await b.get(`${raiz}/juego`);
    if (!juego) throw new Error("Esta partida ya terminó o el código no existe. Escanea el QR que está en la pantalla.");
    const nJug = await b.get(`${raiz}/nJug`);
    if (!(p >= 0 && p < nJug)) throw new Error("Este QR no corresponde a un jugador de la partida.");
    // Un puesto, un celular: si otro ya lo tomó, este no entra.
    const yo = { id: idCliente(), desde: b.hora() };
    if (!(await b.reclamar(`${raiz}/jugadores/${p}`, yo))) throw new Error(OCUPADO);
    const soltar = b.presencia(`${raiz}/jugadores/${p}`, yo, avisoPuestoPerdido);
    return {
      juego, nJug,
      escuchar: (ruta, cb) => b.alValor(`${raiz}/${ruta}`, cb),
      enviar: (jugada) => b.push(`${raiz}/entradas`, { ...jugada, p }),
      /** Escribe un dato propio de este jugador en salas/<código>/<ruta>/<p> (se sobrescribe). */
      marcar: (ruta, v) => b.set(`${raiz}/${ruta}/${p}`, v),
      salir: soltar,
    };
  };

  window.Online = O;

  // =====================================================================
  // Celular: se juega en vertical
  // =====================================================================
  // En Android, al primer toque en un botón se pasa a pantalla completa y se bloquea en
  // vertical (el navegador solo deja bloquear el giro en pantalla completa). En iPhone no
  // se puede bloquear: si se gira, una capa tapa el juego hasta volver a ponerlo vertical.
  // En computadores y tablets no hace nada.
  (function soloVertical() {
    const esCelular = () => {
      try { return matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600; } catch { return false; }
    };
    if (!esCelular()) return;
    // Orientación del aparato (no de la ventana: el teclado al escribir el nombre la achica)
    const apaisado = () => (screen.orientation && screen.orientation.type
      ? screen.orientation.type.startsWith("landscape")
      : Math.abs(Number(window.orientation) || 0) === 90);

    const estilo = document.createElement("style");
    estilo.textContent = `
      .gira-capa { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: 24px;
        background: #0B2545; color: #fff; text-align: center; font: 600 18px/1.4 Poppins, system-ui, sans-serif; touch-action: none; }
      .gira-capa[hidden] { display: none; }
      .gira-capa svg { width: 74px; height: 74px; margin: 0 auto 14px; display: block; animation: gira-vuelta 1.8s ease-in-out infinite; }
      .gira-capa b { display: block; font-size: 22px; font-style: italic; font-weight: 800; margin-bottom: 4px; }
      .gira-capa small { display: block; font-weight: 400; font-size: 15px; opacity: .8; }
      @keyframes gira-vuelta { 0%, 25% { transform: rotate(-90deg); } 60%, 100% { transform: rotate(0deg); } }
      @media (prefers-reduced-motion: reduce) { .gira-capa svg { animation: none; } }`;
    const capa = document.createElement("div");
    capa.className = "gira-capa"; capa.hidden = true;
    capa.setAttribute("role", "alert");
    capa.innerHTML = `<div>
      <svg viewBox="0 0 48 48" fill="none" stroke="#E8772E" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="14" y="4" width="20" height="40" rx="4"/><path d="M21 38h6"/></svg>
      <b>Gira tu celular</b>Este juego se juega con el celular vertical.<small>Ponlo derecho para seguir.</small></div>`;
    const revisar = () => { capa.hidden = !apaisado(); };
    const montar = () => { document.head.append(estilo); document.body.append(capa); revisar(); };
    if (document.body) montar(); else addEventListener("DOMContentLoaded", montar);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener("change", revisar);
    addEventListener("orientationchange", revisar);
    addEventListener("resize", revisar);

    // Bloqueo real (Android): necesita un toque del jugador para pedir pantalla completa.
    let intentado = false;
    document.addEventListener("click", (e) => {
      if (intentado || !e.target.closest("button")) return;
      intentado = true;
      const raiz = document.documentElement;
      const pedir = raiz.requestFullscreen ? raiz.requestFullscreen({ navigationUI: "hide" }) : null;
      Promise.resolve(pedir)
        .then(() => screen.orientation && screen.orientation.lock ? screen.orientation.lock("portrait") : null)
        .catch(() => { /* iPhone u otro navegador sin bloqueo: queda la capa */ });
    }, true);
  })();
})();
