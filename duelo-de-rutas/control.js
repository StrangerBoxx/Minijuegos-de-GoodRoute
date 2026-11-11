/* control.js — Duelo de Rutas en el celular de un jugador.
 *
 * Se abre al escanear el QR de la pantalla del stand (control.html?sala=CÓDIGO&j=N).
 * Muestra el tablero propio: la misma ciudad y los mismos clientes que el resto.
 * Cada toque se manda a la pantalla, que lleva el juego; para que se sienta
 * inmediato, el celular también lo aplica al tiro y luego se alinea con la pantalla.
 */
(() => {
  "use strict";
  const C = window.Comun, O = window.Online;
  const JUGADORES = [
    { nombre: "Azul", color: "#033E84" },
    { nombre: "Verde", color: "#27945c" },
    { nombre: "Morado", color: "#7c54c9" },
    { nombre: "Rosa", color: "#c23b7a" },
  ];

  const $ = (id) => document.getElementById(id);
  const ui = { cab: $("cab"), num: $("cab-num"), nombre: $("cab-nombre"), estado: $("cab-estado"), dato: $("cab-dato"), pie: $("pie"), msg: $("msg"), msgTarjeta: $("msg-tarjeta") };
  const vista = new C.Vista($("mapa"));
  const params = new URLSearchParams(location.search);
  const codigo = (params.get("sala") || "").toUpperCase();
  const p = Number(params.get("j")) - 1;
  const yo = JUGADORES[p];

  let conexion = null, ronda = null, vivo = null, mapa = null;
  let seq = [], enviadas = 0;      // ruta propia (local) y jugadas mandadas
  let nombreEnviado = false;

  // ---------- Mensajes de pantalla completa ----------
  function mensaje(html) {
    ui.msg.hidden = !html;
    if (html) ui.msgTarjeta.innerHTML = html;
  }
  const error = (texto) => mensaje(`<img class="logo" src="logo-goodroute.gif" alt="GoodRoute" /><h2>No se pudo entrar</h2><p class="lead">${C.escapar(texto)}</p>`);

  // ---------- Conexión ----------
  async function iniciar() {
    if (!yo || !codigo) return error("Este enlace no es válido. Escanea el QR que está en la pantalla del stand.");
    document.documentElement.style.setProperty("--color", yo.color);
    document.querySelector('meta[name="theme-color"]').content = yo.color;
    ui.num.textContent = p + 1; ui.nombre.textContent = yo.nombre;
    const motivo = O.motivoNoDisponible();
    if (motivo) return error(motivo);
    try {
      conexion = await O.unirse(codigo, p);
    } catch (e) { return error(e.message || String(e)); }
    ui.estado.textContent = "Duelo de Rutas";
    conexion.escuchar("ronda", (r) => { ronda = r; armarRonda(); });
    conexion.escuchar("vivo", (v) => { vivo = v; alVivo(); });
  }

  function armarRonda() {
    if (!ronda) return;
    mapa = C.crearCiudad({ datos: ronda.ciudad });
    seq = [];
    ajustar();
  }

  function alVivo() {
    if (!vivo) {   // la pantalla cerró la sala
      mensaje(`<img class="logo" src="logo-goodroute.gif" alt="GoodRoute" /><h2>La partida terminó</h2><p class="lead">¡Gracias por jugar! Para otra partida, escanea un QR nuevo en la pantalla.</p>`);
      return;
    }
    const mio = vivo.jug && vivo.jug[p];
    // La pantalla manda: se adopta su ruta cuando ya procesó todas las jugadas de este celular.
    if (mio && (mio.n ?? 0) >= enviadas) seq = mio.seq || [];
    if (vivo.fase === "cuenta" && ronda && ronda.n === vivo.ronda) { seq = mio ? mio.seq || [] : []; }
    pintarEstado();
  }

  // ---------- Estado en pantalla ----------
  function pintarEstado() {
    const f = vivo ? vivo.fase : "sala", mio = vivo && vivo.jug ? vivo.jug[p] : null;
    const n = ronda ? ronda.clientes.length : 0;
    ui.dato.innerHTML = f === "jugar" ? `0:${String(vivo.restante).padStart(2, "0")}<small>tiempo</small>`
      : mio ? `${mio.total}<small>puntos</small>` : "";
    ui.pie.hidden = !(f === "jugar" || f === "resultado");

    if (f === "sala") {
      mensaje(`<p class="eyebrow">Duelo de Rutas</p><div class="grande">${p + 1}</div><h2>¡Listo, ${yo.nombre}!</h2>
        <p class="lead">Mira la pantalla grande: el duelo empieza cuando estén todos conectados.</p>`);
    } else if (f === "cuenta") {
      mensaje(`<p class="eyebrow">Ronda ${vivo.ronda + 1} de ${ronda ? ronda.total : 3}</p><div class="grande">¡Prepárate!</div>
        <p class="lead">${n} clientes. Tócalos en el orden en que los visitarías, desde la base.</p>`);
    } else if (f === "jugar") {
      mensaje(null);
      const listo = seq.length === n;
      ui.pie.innerHTML = listo
        ? `✓ <b>¡Listo!</b> ${cuadras(seq)} cuadras. Toca un cliente para deshacer.`
        : `<b>${seq.length}/${n}</b> clientes · <b>${cuadras(seq)}</b> cuadras · toca uno ya elegido para deshacer`;
    } else if (f === "resultado") {
      mensaje(null);
      const r = mio && mio.ronda;
      ui.pie.innerHTML = r
        ? `<b>+${r.puntos}</b> puntos · ${mio.cuadras} cuadras · el chip: <b>${vivo.chip ? vivo.chip.cuadras : "?"}</b>${r.iguala ? " · ¡igualaste al chip!" : ""}<br>Naranjo: la ruta del chip`
        : "Resultado de la ronda";
    } else if (f === "final") {
      const lugar = vivo.podio ? vivo.podio.indexOf(p) + 1 : 0;
      mensaje(`<p class="eyebrow">Resultado del duelo</p><div class="grande">${lugar}º</div>
        <h2>${lugar === 1 ? "¡Ganaste!" : `Quedaste ${lugar}º`}</h2>
        <p class="lead">${mio ? mio.total : 0} puntos · ${mio ? mio.igualadas : 0} rutas iguales al chip</p>
        ${nombreEnviado ? `<p class="lead">✓ Guardado en el ranking del stand</p>` : `
        <form class="guardar" id="form-nombre"><input id="nombre" maxlength="14" autocomplete="off" placeholder="Tu nombre" aria-label="Tu nombre" />
        <button class="btn" type="submit">Guardar</button></form>`}
        <p class="cta">El chip es GoodRoute: calcula la ruta óptima de cada técnico de tu flota, en segundos.</p>`);
      const form = $("form-nombre");
      if (form) form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nombre = $("nombre").value.trim();
        if (!nombre) return;
        conexion.enviar({ tipo: "nombre", nombre });
        nombreEnviado = true; pintarEstado();
      });
    }
  }

  const cuadras = (s) => {
    if (!ronda || !mapa) return 0;
    let n = ronda.base, t = 0;
    for (const i of s) { t += mapa.dist(n, ronda.clientes[i]); n = ronda.clientes[i]; }
    return t;
  };

  // ---------- Dibujo ----------
  function ajustar() {
    vista.ajustarLienzo();
    if (!mapa) return;
    const arriba = ui.cab.offsetHeight, abajo = ui.pie.hidden ? 60 : ui.pie.offsetHeight;
    vista.encuadrar(mapa, { x: 0, y: arriba, w: innerWidth, h: innerHeight - arriba - abajo }, Math.max(26, Math.min(40, innerWidth * 0.08)));
  }
  addEventListener("resize", ajustar);

  function dibujar() {
    vista.limpiar();
    if (!mapa || !ronda) return;
    vista.ciudad();
    const c = vista.celda, ctx = vista.ctx, f = vivo ? vivo.fase : "";
    const nodos = (s) => s.map((i) => ronda.clientes[i]);
    const tramos = (s) => C.tramosDeRuta(mapa, ronda.base, nodos(s), { minutosPorCuadra: 1, servicios: s.map(() => 0) }).tramos;
    if (f === "resultado" && vivo.chip) vista.trazar(tramos(vivo.chip.orden), Infinity, C.COLOR.gr, Math.max(10, c * 0.16), 0.45);
    vista.trazar(tramos(seq), Infinity, yo.color, Math.max(5, c * 0.08), 0.9);
    vista.base(ronda.base);
    ronda.clientes.forEach((nodo, i) => {
      const k = seq.indexOf(i);
      vista.pin(nodo, k >= 0 ? { relleno: yo.color, borde: yo.color, texto: String(k + 1), radio: Math.max(15, c * 0.24) }
        : { relleno: C.COLOR.blanco, borde: yo.color, radio: Math.max(15, c * 0.24) });
      if (f === "resultado" && vivo.chip) {
        const [x, y] = vista.px(nodo), r = Math.max(15, c * 0.24), er = r * 0.55;
        ctx.beginPath(); ctx.arc(x + r * 0.95, y + r * 0.8, er, 0, Math.PI * 2); ctx.fillStyle = C.COLOR.gr; ctx.fill();
        ctx.fillStyle = C.COLOR.blanco; ctx.font = `700 ${er * 1.1}px "IBM Plex Sans", sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(vivo.chip.orden.indexOf(i) + 1), x + r * 0.95, y + r * 0.8 + 1);
      }
    });
    if (f === "jugar" && seq.length < ronda.clientes.length) {   // dónde vas
      const [x, y] = vista.px(seq.length ? ronda.clientes[seq[seq.length - 1]] : ronda.base);
      ctx.beginPath(); ctx.arc(x, y, Math.max(22, c * 0.34) + 3 * Math.sin(performance.now() / 180), 0, Math.PI * 2);
      ctx.strokeStyle = yo.color; ctx.globalAlpha = 0.45; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // ---------- Toques ----------
  vista.canvas.addEventListener("pointerdown", (e) => {
    if (!vivo || vivo.fase !== "jugar" || !mapa) return;
    const { indice, distancia } = vista.cercano(ronda.clientes, e.clientX, e.clientY);
    if (indice < 0 || distancia > Math.max(30, vista.celda * 0.5)) return;
    // Se aplica al tiro (misma regla que la pantalla) y se manda.
    const k = seq.indexOf(indice);
    seq = k >= 0 ? seq.slice(0, k) : [...seq, indice];
    enviadas++;
    conexion.enviar({ tipo: "tocar", i: indice, n: enviadas });
    navigator.vibrate?.(12);
    pintarEstado();
  });

  let ultimoPie = null;
  function cuadro() {
    // El pie cambia de alto según la fase: se reacomoda el mapa cuando cambia.
    if (ui.pie.hidden !== ultimoPie) { ultimoPie = ui.pie.hidden; ajustar(); }
    dibujar();
    requestAnimationFrame(cuadro);
  }

  window.__estadoCelular = () => ({ p, codigo, ronda, vivo, seq, enviadas, vista });
  iniciar();
  requestAnimationFrame(cuadro);
})();
