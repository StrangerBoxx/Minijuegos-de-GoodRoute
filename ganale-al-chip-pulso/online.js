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
      /** Marca presencia en "ruta" mientras haya conexión (se vuelve a marcar si se corta y vuelve). */
      presencia: (ruta, v) => {
        const info = db.ref(".info/connected");
        const f = (s) => { if (s.val()) { db.ref(ruta).onDisconnect().remove(); db.ref(ruta).set(v); } };
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
    const qr = (p) => { const q = window.qrcode(0, "M"); q.addData(sala.urlControl(p)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); };
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
  /** Une este celular a la sala en el puesto p. Lanza un error con mensaje si no se puede. */
  O.unirse = async (codigo, p) => {
    const b = await O.conectar();
    const raiz = `salas/${codigo}`;
    const juego = await b.get(`${raiz}/juego`);
    if (!juego) throw new Error("Esta partida ya terminó o el código no existe. Escanea el QR que está en la pantalla.");
    const nJug = await b.get(`${raiz}/nJug`);
    if (!(p >= 0 && p < nJug)) throw new Error("Este QR no corresponde a un jugador de la partida.");
    const soltar = b.presencia(`${raiz}/jugadores/${p}`, { desde: b.hora() });
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
})();
