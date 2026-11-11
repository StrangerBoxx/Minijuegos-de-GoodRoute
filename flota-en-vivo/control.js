/* control.js — Flota en Vivo en el celular de un jugador.
 *
 * Se abre al escanear el QR de la pantalla del stand (control.html?sala=CÓDIGO&j=N).
 * Muestra el mismo mapa que la pantalla: las órdenes, su plazo y las camionetas.
 * Tocar una orden la manda a la cola de tu camioneta (la pantalla lleva el juego
 * y confirma). Una orden en la cola de otro, a la que todavía no partió, también
 * se puede tomar.
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
  const ESTADOS = ["oculta", "libre", "asignada", "encamino", "atendida"];

  const $ = (id) => document.getElementById(id);
  const ui = { cab: $("cab"), num: $("cab-num"), nombre: $("cab-nombre"), estado: $("cab-estado"), dato: $("cab-dato"), pie: $("pie"), msg: $("msg"), msgTarjeta: $("msg-tarjeta") };
  const vista = new C.Vista($("mapa"));
  const params = new URLSearchParams(location.search);
  const codigo = (params.get("sala") || "").toUpperCase();
  const p = Number(params.get("j")) - 1;
  const yo = JUGADORES[p];

  let conexion = null, ronda = null, vivo = null, mapa = null;
  let reloj = 0, ultimoVivo = 0;            // reloj del día, extrapolado entre mensajes
  const tomadasLocal = new Map();           // orden → momento en que la toqué (hasta que la pantalla confirme)
  const vansSuaves = [];                    // posición dibujada de cada camioneta (se acerca a la recibida)
  let nombreEnviado = false;

  function mensaje(html) { ui.msg.hidden = !html; if (html) ui.msgTarjeta.innerHTML = html; }
  const error = (texto) => mensaje(`<img class="logo" src="logo-goodroute.gif" alt="GoodRoute" /><h2>No se pudo entrar</h2><p class="lead">${C.escapar(texto)}</p>`);

  // ---------- Conexión ----------
  async function iniciar() {
    if (!yo || !codigo) return error("Este enlace no es válido. Escanea el QR que está en la pantalla del stand.");
    document.documentElement.style.setProperty("--color", yo.color);
    document.querySelector('meta[name="theme-color"]').content = yo.color;
    ui.num.textContent = p + 1; ui.nombre.textContent = yo.nombre;
    const motivo = O.motivoNoDisponible();
    if (motivo) return error(motivo);
    try { conexion = await O.unirse(codigo, p); } catch (e) { return error(e.message || String(e)); }
    ui.estado.textContent = "Flota en Vivo · tu camioneta";
    conexion.escuchar("ronda", (r) => { ronda = r; if (r) { mapa = C.crearCiudad({ datos: r.ciudad }); ajustar(); } });
    conexion.escuchar("vivo", (v) => {
      vivo = v; ultimoVivo = performance.now();
      if (v && v.reloj != null) reloj = v.reloj;
      if (v) for (const [i] of tomadasLocal) if (v.duenios && v.duenios[i] === p && v.estados[i] !== "1") tomadasLocal.delete(i);
      pintarEstado();
    });
  }

  const estado = (i) => (vivo && vivo.estados ? ESTADOS[Number(vivo.estados[i])] : "oculta");
  const duenio = (i) => (vivo && vivo.duenios ? vivo.duenios[i] : -1);

  // ---------- Estado en pantalla ----------
  function pintarEstado() {
    const f = vivo ? vivo.fase : "sala";
    const mias = ronda ? ronda.pedidos.map((_, i) => i).filter((i) => duenio(i) === p) : [];
    const hechas = mias.filter((i) => estado(i) === "atendida").length;
    const cola = vivo && vivo.vans && vivo.vans[p] ? vivo.vans[p].cola : 0;
    ui.pie.hidden = !(f === "jugar" || f === "cuenta" || f === "cierre");
    ui.dato.innerHTML = f === "jugar" || f === "cuenta" || f === "cierre" ? `${C.hhmm(Math.min(reloj, ronda ? ronda.finDia : reloj))}<small>hora</small>` : "";

    if (!vivo && conexion) {
      mensaje(`<img class="logo" src="logo-goodroute.gif" alt="GoodRoute" /><h2>La partida terminó</h2><p class="lead">¡Gracias por jugar! Para otra partida, escanea un QR nuevo en la pantalla.</p>`);
    } else if (f === "sala") {
      mensaje(`<p class="eyebrow">Flota en Vivo</p><div class="grande">${p + 1}</div><h2>¡Listo, ${yo.nombre}!</h2>
        <p class="lead">Eres la camioneta <b>${p + 1}</b>. El día empieza cuando estén todos conectados.</p>`);
    } else if (f === "jugar" || f === "cuenta" || f === "cierre") {
      mensaje(null);
      ui.pie.innerHTML = f === "cierre" ? "<b>17:00</b> · Terminó el día"
        : `Toca una orden para que vaya tu camioneta · <b>${cola}</b> en cola · <b>${hechas}</b> atendidas`;
    } else if (f === "final" && vivo.final) {
      const F = vivo.final, mio = F.jug[p] || { puntos: 0, atendidas: 0, aTiempo: 0, pct: 0 };
      mensaje(`<p class="eyebrow">Fin del día</p><h2>${C.escapar(F.titulo)}</h2>
        <div class="grande">${mio.pct}%</div>
        <p class="lead">de los puntos del equipo fueron tuyos: <b>${mio.puntos}</b> puntos, ${mio.atendidas} órdenes atendidas (${mio.aTiempo} a tiempo).</p>
        <p class="lead">Equipo: <b>${F.puntos}</b> puntos · ${F.equipo.aTiempo} a tiempo (GoodRoute: ${F.equipo.gr})</p>
        ${p === 0 && !F.guardado && !nombreEnviado ? `
        <form class="guardar" id="form-nombre"><input id="nombre" maxlength="14" autocomplete="off" placeholder="Nombre del equipo" aria-label="Nombre del equipo" />
        <button class="btn" type="submit">Guardar</button></form>` : F.guardado ? `<p class="lead">✓ El equipo quedó en el ranking del stand</p>` : ""}
        <p class="cta">Entre todos los equipos del stand ya van ${F.total} órdenes atendidas.</p>`);
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

  // ---------- Dibujo ----------
  function ajustar() {
    vista.ajustarLienzo();
    if (!mapa) return;
    const arriba = ui.cab.offsetHeight, abajo = ui.pie.hidden ? 60 : ui.pie.offsetHeight;
    vista.encuadrar(mapa, { x: 0, y: arriba, w: innerWidth, h: innerHeight - arriba - abajo }, Math.max(24, Math.min(36, innerWidth * 0.07)));
  }
  addEventListener("resize", ajustar);

  const aPantalla = (gx, gy) => [vista.ox + gx * vista.celda, vista.oy + gy * vista.celda];
  const radioPin = () => Math.max(14, vista.celda * 0.24);

  function dibujar(dt) {
    vista.limpiar();
    if (!mapa || !ronda || !vivo) return;
    vista.ciudad();
    const ctx = vista.ctx, c = vista.celda, f = vivo.fase;
    if (f === "jugar") reloj = Math.min(ronda.finDia, reloj + dt * ronda.minutosPorSegundo);   // entre mensajes, el reloj sigue
    ronda.bases.forEach((b, q) => vista.base(b, JUGADORES[q].color, String(q + 1)));

    ronda.pedidos.forEach((o, i) => {
      let est = estado(i), du = duenio(i);
      if (tomadasLocal.has(i) && (est === "libre" || est === "asignada")) { est = "asignada"; du = p; }
      if (est === "oculta") return;
      const [x, y] = vista.px(o.nodo);
      if (est === "atendida") {
        const edad = reloj - (vivo.llegadas ? vivo.llegadas[i] : reloj);
        if (edad > 50) return;
        ctx.save(); ctx.globalAlpha = Math.max(0.15, 1 - edad / 50);
        vista.pin(o.nodo, { relleno: JUGADORES[du].color, borde: JUGADORES[du].color, texto: "✓", radio: radioPin() * 0.8 });
        ctx.restore();
        return;
      }
      const r = radioPin(), tarde = reloj > o.plazo;
      const fr = Math.max(0, Math.min(1, (o.plazo - reloj) / (o.plazo - o.aparece)));
      if (!tarde) {   // anillo del plazo
        ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2); ctx.strokeStyle = "rgba(28,26,27,.08)"; ctx.lineWidth = 5; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2);
        ctx.strokeStyle = fr < 0.3 ? C.COLOR.tarde : o.urgente ? C.COLOR.aviso : "#6b6860"; ctx.lineWidth = 5; ctx.stroke();
      }
      const tomada = est === "asignada" || est === "encamino";
      const mia = tomada && du === p;
      const colorDueno = tomada ? JUGADORES[du].color : null;
      ctx.save();
      if (tomada && !mia) ctx.globalAlpha = 0.55;          // las de otros, más suaves
      vista.pin(o.nodo, {
        relleno: est === "encamino" ? colorDueno : C.COLOR.blanco,
        borde: tomada ? colorDueno : tarde ? C.COLOR.tarde : o.urgente ? C.COLOR.aviso : C.COLOR.texto,
        texto: tomada ? (est === "encamino" ? "→" : "") : tarde ? "!" : o.urgente ? "⚡" : "",
        tinta: est === "encamino" ? C.COLOR.blanco : tarde && !tomada ? C.COLOR.tarde : colorDueno ?? C.COLOR.texto,
        radio: r, discontinuo: tarde && !tomada,
      });
      ctx.restore();
      if (mia) { ctx.beginPath(); ctx.arc(x, y, r + 11, 0, Math.PI * 2); ctx.strokeStyle = yo.color; ctx.lineWidth = 3; ctx.stroke(); }
    });

    // Camionetas: la propia grande y con halo; las otras, más chicas.
    (vivo.vans || []).forEach((v, q) => {
      const s = vansSuaves[q] ??= { x: v.x, y: v.y, ang: v.ang };
      const k = Math.min(1, dt * 10);
      s.x += (v.x - s.x) * k; s.y += (v.y - s.y) * k; s.ang = v.ang;
      const [x, y] = aPantalla(s.x, s.y);
      if (q === p) {
        ctx.beginPath(); ctx.arc(x, y, Math.max(22, c * 0.36), 0, Math.PI * 2);
        ctx.fillStyle = yo.color + "30"; ctx.fill(); ctx.strokeStyle = yo.color; ctx.lineWidth = 3; ctx.stroke();
      }
      vista.furgon({ x, y, ang: s.ang }, JUGADORES[q].color, q !== p);
    });
  }

  // ---------- Toques: tomar una orden ----------
  vista.canvas.addEventListener("pointerdown", (e) => {
    if (!vivo || !(vivo.fase === "jugar" || vivo.fase === "cuenta") || !ronda) return;
    let mejor = -1, dm = Math.max(32, vista.celda * 0.5);
    ronda.pedidos.forEach((o, i) => {
      const est = estado(i);
      if (!(est === "libre" || (est === "asignada" && duenio(i) !== p))) return;
      const [x, y] = vista.px(o.nodo), d = Math.hypot(x - e.clientX, y - e.clientY);
      if (d < dm) { dm = d; mejor = i; }
    });
    if (mejor < 0) return;
    tomadasLocal.set(mejor, performance.now());
    conexion.enviar({ tipo: "tomar", i: mejor });
    navigator.vibrate?.(15);
  });

  let anterior = performance.now(), ultimoPie = null;
  function cuadro(ahora) {
    const dt = Math.min((ahora - anterior) / 1000, 0.1);
    anterior = ahora;
    // Lo tocado y no confirmado en 2 s vuelve a su estado (la pantalla no lo aceptó).
    for (const [i, t] of tomadasLocal) if (ahora - t > 2000) tomadasLocal.delete(i);
    if (ui.pie.hidden !== ultimoPie) { ultimoPie = ui.pie.hidden; ajustar(); }
    if (vivo && (vivo.fase === "jugar")) ui.dato.innerHTML = `${C.hhmm(reloj)}<small>hora</small>`;
    dibujar(dt);
    requestAnimationFrame(cuadro);
  }

  window.__estadoCelular = () => ({ p, codigo, ronda, vivo, reloj, vista, tomadasLocal });
  iniciar();
  requestAnimationFrame(cuadro);
})();
